const VehicleModel = require('../models/vehicleModel');
const TripModel = require('../models/tripModel');
const MaintenanceModel = require('../models/maintenanceModel');
const RepairModel = require('../models/repairModel');
const ForecastModel = require('../models/forecastModel');
const AlertModel = require('../models/alertModel');
const forecastService = require('../services/forecastService');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/** GET /api/vehicles */
const getVehicles = asyncHandler(async (req, res) => {
  const { search, status, type, page, limit, basic } = req.query;

  if (basic === 'true') {
    const rows = await VehicleModel.findAllBasic();
    return res.status(200).json({ success: true, data: rows });
  }

  const result = await VehicleModel.findAll({ search, status, type, page, limit });
  res.status(200).json({
    success: true,
    data: result.rows,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    },
  });
});

/** GET /api/vehicles/:id - full detail view with every related record. */
const getVehicleById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await VehicleModel.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const [trips, maintenance, repairs, forecast, alerts] = await Promise.all([
    TripModel.findByVehicle(id, 25),
    MaintenanceModel.findByVehicle(id, 25),
    RepairModel.findByVehicle(id, 25),
    ForecastModel.findLatestForVehicle(id),
    AlertModel.findByVehicle(id, 20),
  ]);

  res.status(200).json({
    success: true,
    data: {
      vehicle,
      trips,
      maintenance,
      repairs,
      forecast,
      alerts,
      summary: {
        total_trips: trips.length,
        total_distance: trips
          .filter((t) => t.trip_status === 'Completed')
          .reduce((sum, t) => sum + Number(t.distance_km || 0), 0),
        total_maintenance_cost: maintenance.reduce(
          (sum, m) => sum + Number(m.service_cost || 0), 0
        ),
        total_repair_cost: repairs.reduce((sum, r) => sum + Number(r.repair_cost || 0), 0),
        total_downtime_hours: repairs.reduce(
          (sum, r) => sum + Number(r.downtime_hours || 0), 0
        ),
      },
    },
  });
});

/** POST /api/vehicles */
const createVehicle = asyncHandler(async (req, res) => {
  const existing = await VehicleModel.findByNumber(req.body.vehicle_number);
  if (existing) {
    throw new ApiError(400, `Vehicle number ${req.body.vehicle_number} is already registered`);
  }

  const vehicle = await VehicleModel.create({
    vehicle_number: req.body.vehicle_number,
    vehicle_type: req.body.vehicle_type,
    manufacturer: req.body.manufacturer,
    model: req.body.model,
    purchase_date: req.body.purchase_date || null,
    registration_date: req.body.registration_date || null,
    current_odometer: req.body.current_odometer ?? 0,
    fuel_type: req.body.fuel_type || 'Diesel',
    status: req.body.status || 'Available',
    last_service_date: req.body.last_service_date || null,
    next_service_date: req.body.next_service_date || null,
  });

  res.status(201).json({ success: true, data: vehicle });
});

/** PUT /api/vehicles/:id */
const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await VehicleModel.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  if (req.body.vehicle_number && req.body.vehicle_number !== vehicle.vehicle_number) {
    const clash = await VehicleModel.findByNumber(req.body.vehicle_number);
    if (clash) {
      throw new ApiError(400, `Vehicle number ${req.body.vehicle_number} is already registered`);
    }
  }

  const updated = await VehicleModel.update(id, req.body);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/vehicles/:id */
const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await VehicleModel.findById(id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const onTrip = await TripModel.hasActiveTrip(id);
  if (onTrip) {
    throw new ApiError(400, 'Cannot delete a vehicle with a scheduled or ongoing trip');
  }

  await VehicleModel.remove(id);
  res.status(200).json({
    success: true,
    data: { message: `Vehicle ${vehicle.vehicle_number} deleted successfully` },
  });
});

/** GET /api/vehicles/:id/forecast - live forecast without persisting. */
const getVehicleForecast = asyncHandler(async (req, res) => {
  const forecast = await forecastService.previewForecast(req.params.id);
  if (!forecast) throw new ApiError(404, 'Vehicle not found');
  res.status(200).json({ success: true, data: forecast });
});

/** GET /api/vehicles/meta/options - dropdown data for the UI. */
const getVehicleOptions = asyncHandler(async (req, res) => {
  const [types, statusCounts] = await Promise.all([
    VehicleModel.findDistinctTypes(),
    VehicleModel.countByStatus(),
  ]);
  res.status(200).json({ success: true, data: { types, statusCounts } });
});

/** GET /api/vehicles/availability - the availability board. */
const getAvailability = asyncHandler(async (req, res) => {
  const [statusCounts, vehicles, activeRepairs] = await Promise.all([
    VehicleModel.countByStatus(),
    VehicleModel.findAllBasic(),
    RepairModel.findActive(),
  ]);

  const repairByVehicle = new Map();
  activeRepairs.forEach((r) => {
    if (!repairByVehicle.has(r.vehicle_id)) repairByVehicle.set(r.vehicle_id, r);
  });

  const total = vehicles.length;
  const available = vehicles.filter((v) => v.status === 'Available').length;

  res.status(200).json({
    success: true,
    data: {
      total,
      available,
      availability_rate: total ? Number(((available / total) * 100).toFixed(1)) : 0,
      status_counts: statusCounts,
      vehicles: vehicles.map((v) => ({
        ...v,
        active_repair: repairByVehicle.get(v.vehicle_id) || null,
      })),
    },
  });
});

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleForecast,
  getVehicleOptions,
  getAvailability,
};
