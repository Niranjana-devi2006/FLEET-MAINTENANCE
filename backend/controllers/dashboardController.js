const VehicleModel = require('../models/vehicleModel');
const TripModel = require('../models/tripModel');
const MaintenanceModel = require('../models/maintenanceModel');
const RepairModel = require('../models/repairModel');
const ForecastModel = require('../models/forecastModel');
const AlertModel = require('../models/alertModel');
const DriverModel = require('../models/driverModel');
const { asyncHandler } = require('../middleware/errorMiddleware');

const UTILISATION_WINDOW_DAYS = 30;

function statusCount(rows, status) {
  const row = rows.find((r) => r.status === status);
  return row ? row.count : 0;
}

/**
 * GET /api/dashboard/stats
 * Every number here is computed from the database on request.
 */
const getStats = asyncHandler(async (req, res) => {
  const [
    statusCounts,
    totalVehicles,
    requiringService,
    upcomingCount,
    openRepairs,
    maintenanceCost,
    repairCost,
    criticalAlerts,
    unreadAlerts,
    totalDrivers,
    occupiedDays,
    forecastCritical,
  ] = await Promise.all([
    VehicleModel.countByStatus(),
    VehicleModel.countAll(),
    VehicleModel.findRequiringService(30),
    MaintenanceModel.countUpcoming(30),
    RepairModel.countOpen(),
    MaintenanceModel.totalCost(),
    RepairModel.totalCost(),
    AlertModel.countCritical(),
    AlertModel.countUnread(),
    DriverModel.countAll(),
    TripModel.fleetUtilisation(UTILISATION_WINDOW_DAYS),
    ForecastModel.countCritical(),
  ]);

  // Fleet utilisation = vehicle-days actually on trips / vehicle-days available.
  const capacity = totalVehicles * UTILISATION_WINDOW_DAYS;
  const fleetUtilisation = capacity
    ? Number(((occupiedDays / capacity) * 100).toFixed(1))
    : 0;

  res.status(200).json({
    success: true,
    data: {
      total_vehicles: totalVehicles,
      available_vehicles: statusCount(statusCounts, 'Available'),
      vehicles_on_trip: statusCount(statusCounts, 'On Trip'),
      vehicles_under_maintenance: statusCount(statusCounts, 'Under Maintenance'),
      vehicles_out_of_service: statusCount(statusCounts, 'Out of Service'),
      vehicles_requiring_service: requiringService.length,
      upcoming_services: upcomingCount,
      open_repairs: openRepairs,
      total_maintenance_cost: Number(maintenanceCost),
      total_repair_cost: Number(repairCost),
      total_cost: Number(maintenanceCost) + Number(repairCost),
      fleet_utilisation: fleetUtilisation,
      critical_alerts: criticalAlerts,
      unread_alerts: unreadAlerts,
      total_drivers: totalDrivers,
      high_risk_forecasts: forecastCritical,
      utilisation_window_days: UTILISATION_WINDOW_DAYS,
    },
  });
});

/**
 * GET /api/dashboard/charts
 * Data series for all seven dashboard charts.
 */
const getCharts = asyncHandler(async (req, res) => {
  const months = Number(req.query.months) || 12;

  const [
    maintenanceCostByMonth,
    repairCostByMonth,
    utilisation,
    maintenanceFrequency,
    statusDistribution,
    upcoming,
    downtime,
  ] = await Promise.all([
    MaintenanceModel.costByMonth(months),
    RepairModel.costByMonth(months),
    TripModel.utilisationByVehicle(90),
    MaintenanceModel.frequencyByType(months),
    VehicleModel.countByStatus(),
    VehicleModel.findRequiringService(90),
    RepairModel.downtimeByVehicle(months),
  ]);

  res.status(200).json({
    success: true,
    data: {
      maintenance_cost_by_month: maintenanceCostByMonth,
      repair_cost_by_month: repairCostByMonth,
      vehicle_utilisation: utilisation,
      maintenance_frequency: maintenanceFrequency,
      vehicle_status_distribution: statusDistribution,
      upcoming_maintenance: upcoming.map((v) => ({
        vehicle_number: v.vehicle_number,
        next_service_date: v.next_service_date,
        days_remaining: v.days_remaining,
        status: v.status,
      })),
      repair_downtime: downtime,
    },
  });
});

/**
 * GET /api/dashboard/tables
 * The five dashboard tables in one round-trip.
 */
const getTables = asyncHandler(async (req, res) => {
  const [
    requiringMaintenance,
    upcomingServices,
    recentRepairs,
    recentTrips,
    criticalAlerts,
  ] = await Promise.all([
    VehicleModel.findRequiringService(30),
    MaintenanceModel.upcoming(45, 10),
    RepairModel.recent(10),
    TripModel.recent(10),
    AlertModel.findAll({ priority: 'Critical', limit: 10 }),
  ]);

  // Fall back to High-priority alerts when nothing is Critical, so the panel
  // still shows what needs attention.
  let alerts = criticalAlerts;
  if (alerts.length === 0) {
    alerts = await AlertModel.findAll({ priority: 'High', limit: 10 });
  }

  res.status(200).json({
    success: true,
    data: {
      vehicles_requiring_maintenance: requiringMaintenance,
      upcoming_services: upcomingServices,
      recent_repairs: recentRepairs,
      recent_trips: recentTrips,
      critical_alerts: alerts,
    },
  });
});

/**
 * GET /api/dashboard
 * Convenience endpoint returning stats, charts and tables together.
 */
const getOverview = asyncHandler(async (req, res) => {
  const collect = (handler) =>
    new Promise((resolve, reject) => {
      handler(
        req,
        { status: () => ({ json: (payload) => resolve(payload.data) }) },
        reject
      ).catch(reject);
    });

  const [stats, charts, tables] = await Promise.all([
    collect(getStats),
    collect(getCharts),
    collect(getTables),
  ]);

  res.status(200).json({ success: true, data: { stats, charts, tables } });
});

module.exports = { getStats, getCharts, getTables, getOverview };
