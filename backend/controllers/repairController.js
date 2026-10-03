const { transaction } = require('../config/db');
const RepairModel = require('../models/repairModel');
const VehicleModel = require('../models/vehicleModel');
const TripModel = require('../models/tripModel');
const alertService = require('../services/alertService');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

const ACTIVE = ['Open', 'In Progress'];

/**
 * Once a repair closes, put the vehicle back to Available - unless other work
 * is still outstanding or an operator deliberately grounded it.
 */
async function releaseVehicleIfIdle(vehicleId, conn) {
  const stillRepairing = await RepairModel.hasActiveRepair(vehicleId, null, conn);
  const [maintRows] = await conn.execute(
    `SELECT COUNT(*) AS count FROM maintenance
     WHERE vehicle_id = ? AND status IN ('Scheduled','In Progress')`,
    [vehicleId]
  );
  const [vehRows] = await conn.execute(
    'SELECT status FROM vehicles WHERE vehicle_id = ?',
    [vehicleId]
  );

  if (
    !stillRepairing &&
    maintRows[0].count === 0 &&
    vehRows[0] &&
    vehRows[0].status === 'Under Maintenance'
  ) {
    await VehicleModel.updateStatus(vehicleId, 'Available', conn);
  }
}

/** GET /api/repairs */
const getRepairs = asyncHandler(async (req, res) => {
  const { search, status, vehicle_id, technician, from, to, page, limit } = req.query;

  const result = await RepairModel.findAll({
    search, status, vehicle_id, technician, from, to, page, limit,
  });

  res.status(200).json({
    success: true,
    data: result.rows,
    pagination: {
      total: result.total, page: result.page, limit: result.limit, pages: result.pages,
    },
  });
});

/** GET /api/repairs/:id */
const getRepairById = asyncHandler(async (req, res) => {
  const repair = await RepairModel.findById(req.params.id);
  if (!repair) throw new ApiError(404, 'Repair record not found');
  res.status(200).json({ success: true, data: repair });
});

/**
 * POST /api/repairs
 * An active repair immediately moves the vehicle to Under Maintenance.
 */
const createRepair = asyncHandler(async (req, res) => {
  const vehicleId = req.body.vehicle_id;
  const status = req.body.status || 'Open';

  const vehicle = await VehicleModel.findById(vehicleId);
  if (!vehicle) throw new ApiError(404, 'Selected vehicle not found');

  if (ACTIVE.includes(status)) {
    const onTrip = await TripModel.hasActiveTrip(vehicleId);
    if (onTrip) {
      throw new ApiError(
        400,
        `${vehicle.vehicle_number} has an active trip - complete or cancel it before booking a repair`
      );
    }
  }

  const id = await transaction(async (conn) => {
    const newId = await RepairModel.create(
      {
        vehicle_id: vehicleId,
        repair_date: req.body.repair_date,
        problem_description: req.body.problem_description,
        repair_description: req.body.repair_description || null,
        parts_replaced: req.body.parts_replaced || null,
        repair_cost: req.body.repair_cost ?? 0,
        downtime_hours: req.body.downtime_hours ?? 0,
        technician: req.body.technician || null,
        status,
        remarks: req.body.remarks || null,
      },
      conn
    );

    if (ACTIVE.includes(status)) {
      await VehicleModel.updateStatus(vehicleId, 'Under Maintenance', conn);
    } else if (status === 'Completed') {
      await releaseVehicleIfIdle(vehicleId, conn);
    }

    return newId;
  });

  // Surface the new repair on the dashboard right away.
  if (ACTIVE.includes(status)) {
    await alertService.raiseAlert({
      vehicle_id: vehicleId,
      alert_type: alertService.TYPES.UNDER_REPAIR,
      alert_message: `${vehicle.vehicle_number} is under repair: ${String(req.body.problem_description).slice(0, 120)}`,
      priority: 'Medium',
    });
  }

  const repair = await RepairModel.findById(id);
  res.status(201).json({ success: true, data: repair });
});

/**
 * PUT /api/repairs/:id
 * Completing a repair releases the vehicle back to Available.
 */
const updateRepair = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repair = await RepairModel.findById(id);
  if (!repair) throw new ApiError(404, 'Repair record not found');

  const newStatus = req.body.status || repair.status;
  const vehicleId = req.body.vehicle_id ?? repair.vehicle_id;

  await transaction(async (conn) => {
    await RepairModel.update(id, req.body, conn);

    if (ACTIVE.includes(newStatus)) {
      await VehicleModel.updateStatus(vehicleId, 'Under Maintenance', conn);
    } else {
      // Completed or Cancelled.
      await releaseVehicleIfIdle(vehicleId, conn);
    }
  });

  const updated = await RepairModel.findById(id);
  res.status(200).json({ success: true, data: updated });
});

/**
 * PUT /api/repairs/:id/complete
 * Convenience endpoint for the technician workflow.
 */
const completeRepair = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repair = await RepairModel.findById(id);
  if (!repair) throw new ApiError(404, 'Repair record not found');
  if (repair.status === 'Completed') {
    throw new ApiError(400, 'This repair is already completed');
  }

  await transaction(async (conn) => {
    await RepairModel.update(
      id,
      {
        status: 'Completed',
        repair_description: req.body.repair_description ?? repair.repair_description,
        parts_replaced: req.body.parts_replaced ?? repair.parts_replaced,
        repair_cost: req.body.repair_cost ?? repair.repair_cost,
        downtime_hours: req.body.downtime_hours ?? repair.downtime_hours,
        remarks: req.body.remarks ?? repair.remarks,
      },
      conn
    );
    await releaseVehicleIfIdle(repair.vehicle_id, conn);
  });

  const updated = await RepairModel.findById(id);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/repairs/:id */
const deleteRepair = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repair = await RepairModel.findById(id);
  if (!repair) throw new ApiError(404, 'Repair record not found');

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM repairs WHERE repair_id = ?', [id]);
    await releaseVehicleIfIdle(repair.vehicle_id, conn);
  });

  res.status(200).json({ success: true, data: { message: 'Repair record deleted successfully' } });
});

/** GET /api/repairs/open/list */
const getOpenRepairs = asyncHandler(async (req, res) => {
  const rows = await RepairModel.findActive();
  res.status(200).json({ success: true, data: rows });
});

module.exports = {
  getRepairs,
  getRepairById,
  createRepair,
  updateRepair,
  completeRepair,
  deleteRepair,
  getOpenRepairs,
};
