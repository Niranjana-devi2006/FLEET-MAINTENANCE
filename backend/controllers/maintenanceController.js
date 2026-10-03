const { transaction, query } = require('../config/db');
const MaintenanceModel = require('../models/maintenanceModel');
const VehicleModel = require('../models/vehicleModel');
const RepairModel = require('../models/repairModel');
const TripModel = require('../models/tripModel');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/**
 * Work out the next service date/odometer from the service_types catalogue
 * when the caller did not supply them.
 */
async function deriveNextService(maintenanceType, serviceDate, odometer) {
  const rows = await query(
    'SELECT service_interval_km, service_interval_days FROM service_types WHERE service_name = ?',
    [maintenanceType]
  );
  const interval = rows[0] || { service_interval_km: 10000, service_interval_days: 180 };

  const base = new Date(`${serviceDate}T00:00:00`);
  base.setDate(base.getDate() + interval.service_interval_days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');

  return {
    next_service_date: `${y}-${m}-${d}`,
    next_service_odometer: Number(odometer || 0) + interval.service_interval_km,
  };
}

/** Release a vehicle from maintenance once no work is outstanding. */
async function releaseVehicleIfIdle(vehicleId, conn) {
  const [maintRows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM maintenance
     WHERE vehicle_id = ? AND status IN ('Scheduled','In Progress')`,
    [vehicleId]
  );
  const stillUnderRepair = await RepairModel.hasActiveRepair(vehicleId, null, conn);

  if (maintRows[0].count === 0 && !stillUnderRepair) {
    const [vehRows] = await conn.execute(
      'SELECT status FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );
    // Never override a manual "Out of Service" grounding.
    if (vehRows[0] && vehRows[0].status === 'Under Maintenance') {
      await VehicleModel.updateStatus(vehicleId, 'Available', conn);
    }
  }
}

/** GET /api/maintenance */
const getMaintenance = asyncHandler(async (req, res) => {
  const { search, status, vehicle_id, type, technician, from, to, page, limit } = req.query;

  const result = await MaintenanceModel.findAll({
    search, status, vehicle_id, type, technician, from, to, page, limit,
  });

  res.status(200).json({
    success: true,
    data: result.rows,
    pagination: {
      total: result.total, page: result.page, limit: result.limit, pages: result.pages,
    },
  });
});

/** GET /api/maintenance/:id */
const getMaintenanceById = asyncHandler(async (req, res) => {
  const record = await MaintenanceModel.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Maintenance record not found');
  res.status(200).json({ success: true, data: record });
});

/**
 * POST /api/maintenance
 * Scheduling or starting work moves the vehicle to Under Maintenance.
 */
const createMaintenance = asyncHandler(async (req, res) => {
  const vehicleId = req.body.vehicle_id;
  const status = req.body.status || 'Scheduled';

  const vehicle = await VehicleModel.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Selected vehicle not found');

  if (status === 'In Progress') {
    const onTrip = await TripModel.hasActiveTrip(vehicleId);
    if (onTrip) {
      throw new ApiError(
        400,
        `${vehicle.vehicle_number} has an active trip - complete or cancel it before starting maintenance`
      );
    }
  }

  const odometer = req.body.odometer_reading ?? vehicle.current_odometer;

  // Fill in the next-service projection when the caller left it blank.
  let nextDate = req.body.next_service_date || null;
  let nextOdo = req.body.next_service_odometer ?? null;
  if (status === 'Completed' && (!nextDate || nextOdo === null)) {
    const derived = await deriveNextService(
      req.body.maintenance_type, req.body.service_date, odometer
    );
    nextDate = nextDate || derived.next_service_date;
    nextOdo = nextOdo ?? derived.next_service_odometer;
  }

  const id = await transaction(async (conn) => {
    const newId = await MaintenanceModel.create(
      {
        vehicle_id: vehicleId,
        maintenance_type: req.body.maintenance_type,
        service_date: req.body.service_date,
        odometer_reading: odometer,
        description: req.body.description || null,
        service_cost: req.body.service_cost ?? 0,
        next_service_date: nextDate,
        next_service_odometer: nextOdo,
        status,
        technician: req.body.technician || null,
        remarks: req.body.remarks || null,
      },
      conn
    );

    if (status === 'In Progress') {
      await VehicleModel.updateStatus(vehicleId, 'Under Maintenance', conn);
    } else if (status === 'Completed') {
      // Roll the vehicle's service dates forward from this record.
      await conn.execute(
        `UPDATE vehicles
         SET last_service_date = ?, next_service_date = ?,
             current_odometer = GREATEST(current_odometer, ?)
         WHERE vehicle_id = ?`,
        [req.body.service_date, nextDate, odometer, vehicleId]
      );
      await releaseVehicleIfIdle(vehicleId, conn);
    }

    return newId;
  });

  const record = await MaintenanceModel.findById(id);
  res.status(201).json({ success: true, data: record });
});

/**
 * PUT /api/maintenance/:id
 * Completing a record updates the vehicle's service dates and frees it up.
 */
const updateMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const record = await MaintenanceModel.findById(id);
  if (!record) throw new ApiError(404, 'Maintenance record not found');

  const newStatus = req.body.status || record.status;
  const vehicleId = req.body.vehicle_id ?? record.vehicle_id;
  const serviceDate = req.body.service_date || record.service_date;
  const odometer = req.body.odometer_reading ?? record.odometer_reading;

  let nextDate = req.body.next_service_date ?? record.next_service_date;
  let nextOdo = req.body.next_service_odometer ?? record.next_service_odometer;

  const becomingComplete = newStatus === 'Completed' && record.status !== 'Completed';

  if (becomingComplete && (!nextDate || nextOdo === null)) {
    const derived = await deriveNextService(
      req.body.maintenance_type || record.maintenance_type, serviceDate, odometer
    );
    nextDate = nextDate || derived.next_service_date;
    nextOdo = nextOdo ?? derived.next_service_odometer;
  }

  await transaction(async (conn) => {
    await MaintenanceModel.update(
      id,
      { ...req.body, next_service_date: nextDate, next_service_odometer: nextOdo },
      conn
    );

    if (newStatus === 'In Progress') {
      await VehicleModel.updateStatus(vehicleId, 'Under Maintenance', conn);
    } else if (newStatus === 'Completed') {
      await conn.execute(
        `UPDATE vehicles
         SET last_service_date = ?, next_service_date = ?,
             current_odometer = GREATEST(current_odometer, ?)
         WHERE vehicle_id = ?`,
        [serviceDate, nextDate, odometer, vehicleId]
      );
      await releaseVehicleIfIdle(vehicleId, conn);
    } else if (newStatus === 'Cancelled') {
      await releaseVehicleIfIdle(vehicleId, conn);
    }
  });

  const updated = await MaintenanceModel.findById(id);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/maintenance/:id */
const deleteMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const record = await MaintenanceModel.findById(id);
  if (!record) throw new ApiError(404, 'Maintenance record not found');

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM maintenance WHERE maintenance_id = ?', [id]);
    await releaseVehicleIfIdle(record.vehicle_id, conn);
  });

  res.status(200).json({
    success: true,
    data: { message: 'Maintenance record deleted successfully' },
  });
});

/** GET /api/maintenance/upcoming/list */
const getUpcoming = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const rows = await MaintenanceModel.upcoming(days);
  res.status(200).json({ success: true, data: rows });
});

/**
 * GET /api/maintenance/assigned/me
 * A technician's own queue, matched on the technician name field.
 */
const getAssignedToMe = asyncHandler(async (req, res) => {
  const [maintenance, repairs] = await Promise.all([
    MaintenanceModel.findAssignedTo(req.user.name, { status: req.query.status }),
    RepairModel.findAssignedTo(req.user.name, { status: req.query.status }),
  ]);
  res.status(200).json({ success: true, data: { maintenance, repairs } });
});

/** GET /api/maintenance/meta/service-types */
const getServiceTypes = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM service_types ORDER BY service_name');
  res.status(200).json({ success: true, data: rows });
});

module.exports = {
  getMaintenance,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getUpcoming,
  getAssignedToMe,
  getServiceTypes,
};
