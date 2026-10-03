/**
 * Reporting endpoints.
 *
 * Every report accepts the same filter set where it makes sense:
 *   vehicle_id, from, to, type, status
 */
const { query } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/** Build a WHERE clause from the shared filters. */
function buildFilters(req, { dateColumn, alias }) {
  const where = [];
  const params = [];

  if (req.query.vehicle_id) {
    where.push(`${alias}.vehicle_id = ?`);
    params.push(req.query.vehicle_id);
  }
  if (req.query.from) {
    where.push(`${alias}.${dateColumn} >= ?`);
    params.push(req.query.from);
  }
  if (req.query.to) {
    where.push(`${alias}.${dateColumn} <= ?`);
    params.push(req.query.to);
  }
  if (req.query.status) {
    where.push(`${alias}.status = ?`);
    params.push(req.query.status);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params, where };
}

/** GET /api/reports/maintenance-history */
const maintenanceHistory = asyncHandler(async (req, res) => {
  const { where, params } = buildFilters(req, { dateColumn: 'service_date', alias: 'm' });

  if (req.query.type) {
    where.push('m.maintenance_type = ?');
    params.push(req.query.type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT m.maintenance_id, v.vehicle_number, v.vehicle_type, m.maintenance_type,
            m.service_date, m.odometer_reading, m.service_cost, m.status,
            m.technician, m.next_service_date, m.next_service_odometer, m.description
     FROM maintenance m
     JOIN vehicles v ON v.vehicle_id = m.vehicle_id
     ${whereSql}
     ORDER BY m.service_date DESC`,
    params
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.total_cost += Number(r.service_cost || 0);
      return acc;
    },
    { count: 0, total_cost: 0 }
  );

  res.status(200).json({
    success: true,
    data: rows,
    summary: {
      ...totals,
      average_cost: totals.count ? Number((totals.total_cost / totals.count).toFixed(2)) : 0,
    },
  });
});

/** GET /api/reports/repair-history */
const repairHistory = asyncHandler(async (req, res) => {
  const { whereSql, params } = buildFilters(req, { dateColumn: 'repair_date', alias: 'r' });

  const rows = await query(
    `SELECT r.repair_id, v.vehicle_number, v.vehicle_type, r.repair_date,
            r.problem_description, r.repair_description, r.parts_replaced,
            r.repair_cost, r.downtime_hours, r.technician, r.status
     FROM repairs r
     JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     ${whereSql}
     ORDER BY r.repair_date DESC`,
    params
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.total_cost += Number(r.repair_cost || 0);
      acc.total_downtime += Number(r.downtime_hours || 0);
      return acc;
    },
    { count: 0, total_cost: 0, total_downtime: 0 }
  );

  res.status(200).json({
    success: true,
    data: rows,
    summary: {
      ...totals,
      average_cost: totals.count ? Number((totals.total_cost / totals.count).toFixed(2)) : 0,
      average_downtime: totals.count
        ? Number((totals.total_downtime / totals.count).toFixed(2))
        : 0,
    },
  });
});

/** GET /api/reports/maintenance-costs - cost rolled up per vehicle. */
const maintenanceCosts = asyncHandler(async (req, res) => {
  const params = [];
  const dateFilter = [];
  if (req.query.from) {
    dateFilter.push('m.service_date >= ?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    dateFilter.push('m.service_date <= ?');
    params.push(req.query.to);
  }
  const joinFilter = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.current_odometer,
            COUNT(m.maintenance_id)                AS service_count,
            COALESCE(SUM(m.service_cost), 0)       AS total_cost,
            COALESCE(AVG(m.service_cost), 0)       AS average_cost,
            MAX(m.service_date)                    AS last_service
     FROM vehicles v
     LEFT JOIN maintenance m ON m.vehicle_id = v.vehicle_id ${joinFilter}
     GROUP BY v.vehicle_id, v.vehicle_number, v.vehicle_type, v.current_odometer
     ORDER BY total_cost DESC`,
    params
  );

  res.status(200).json({
    success: true,
    data: rows,
    summary: {
      total_cost: rows.reduce((s, r) => s + Number(r.total_cost), 0),
      vehicles: rows.length,
    },
  });
});

/** GET /api/reports/repair-costs */
const repairCosts = asyncHandler(async (req, res) => {
  const params = [];
  const dateFilter = [];
  if (req.query.from) {
    dateFilter.push('r.repair_date >= ?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    dateFilter.push('r.repair_date <= ?');
    params.push(req.query.to);
  }
  const joinFilter = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type,
            COUNT(r.repair_id)                  AS repair_count,
            COALESCE(SUM(r.repair_cost), 0)     AS total_cost,
            COALESCE(AVG(r.repair_cost), 0)     AS average_cost,
            COALESCE(SUM(r.downtime_hours), 0)  AS total_downtime
     FROM vehicles v
     LEFT JOIN repairs r ON r.vehicle_id = v.vehicle_id ${joinFilter}
     GROUP BY v.vehicle_id, v.vehicle_number, v.vehicle_type
     ORDER BY total_cost DESC`,
    params
  );

  res.status(200).json({
    success: true,
    data: rows,
    summary: {
      total_cost: rows.reduce((s, r) => s + Number(r.total_cost), 0),
      total_downtime: rows.reduce((s, r) => s + Number(r.total_downtime), 0),
    },
  });
});

/** GET /api/reports/vehicle-utilisation */
const vehicleUtilisation = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 90;

  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status, v.current_odometer,
            COUNT(t.trip_id)                       AS trip_count,
            COALESCE(SUM(t.distance_km), 0)        AS total_distance,
            COALESCE(SUM(t.fuel_consumed), 0)      AS total_fuel,
            COALESCE(SUM(DATEDIFF(COALESCE(t.end_date, CURDATE()), t.start_date) + 1), 0) AS days_on_trip,
            ROUND(
              COALESCE(SUM(DATEDIFF(COALESCE(t.end_date, CURDATE()), t.start_date) + 1), 0)
              / ? * 100, 1
            ) AS utilisation_percent
     FROM vehicles v
     LEFT JOIN trips t
       ON t.vehicle_id = v.vehicle_id
      AND t.trip_status IN ('Completed','Ongoing')
      AND t.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status, v.current_odometer
     ORDER BY total_distance DESC`,
    [days, days]
  );

  res.status(200).json({ success: true, data: rows, summary: { window_days: days } });
});

/** GET /api/reports/fleet-availability */
const fleetAvailability = asyncHandler(async (req, res) => {
  const [statusRows, typeRows] = await Promise.all([
    query('SELECT status, COUNT(*) AS count FROM vehicles GROUP BY status'),
    query(
      `SELECT vehicle_type,
              COUNT(*) AS total,
              SUM(status = 'Available')         AS available,
              SUM(status = 'On Trip')           AS on_trip,
              SUM(status = 'Under Maintenance') AS under_maintenance,
              SUM(status = 'Out of Service')    AS out_of_service
       FROM vehicles GROUP BY vehicle_type ORDER BY vehicle_type`
    ),
  ]);

  const total = statusRows.reduce((s, r) => s + r.count, 0);
  const available = statusRows.find((r) => r.status === 'Available');

  res.status(200).json({
    success: true,
    data: { by_status: statusRows, by_type: typeRows },
    summary: {
      total,
      available: available ? available.count : 0,
      availability_rate: total
        ? Number((((available ? available.count : 0) / total) * 100).toFixed(1))
        : 0,
    },
  });
});

/** GET /api/reports/upcoming-maintenance */
const upcomingMaintenance = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;

  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status,
            v.current_odometer, v.last_service_date, v.next_service_date,
            DATEDIFF(v.next_service_date, CURDATE()) AS days_remaining,
            f.risk_level, f.predicted_service_date, f.predicted_odometer, f.maintenance_type
     FROM vehicles v
     LEFT JOIN maintenance_forecast f
       ON f.vehicle_id = v.vehicle_id
      AND f.forecast_id = (
        SELECT MAX(forecast_id) FROM maintenance_forecast WHERE vehicle_id = v.vehicle_id
      )
     WHERE v.next_service_date IS NOT NULL
       AND v.next_service_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY v.next_service_date ASC`,
    [days]
  );

  res.status(200).json({ success: true, data: rows, summary: { count: rows.length, window_days: days } });
});

/** GET /api/reports/overdue-maintenance */
const overdueMaintenance = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status,
            v.current_odometer, v.last_service_date, v.next_service_date,
            ABS(DATEDIFF(v.next_service_date, CURDATE())) AS days_overdue,
            f.risk_level, f.reason
     FROM vehicles v
     LEFT JOIN maintenance_forecast f
       ON f.vehicle_id = v.vehicle_id
      AND f.forecast_id = (
        SELECT MAX(forecast_id) FROM maintenance_forecast WHERE vehicle_id = v.vehicle_id
      )
     WHERE v.next_service_date IS NOT NULL AND v.next_service_date < CURDATE()
     ORDER BY v.next_service_date ASC`
  );

  res.status(200).json({ success: true, data: rows, summary: { count: rows.length } });
});

/** GET /api/reports/repair-downtime */
const repairDowntime = asyncHandler(async (req, res) => {
  const params = [];
  const filter = [];
  if (req.query.from) {
    filter.push('r.repair_date >= ?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    filter.push('r.repair_date <= ?');
    params.push(req.query.to);
  }
  const joinFilter = filter.length ? `AND ${filter.join(' AND ')}` : '';

  const rows = await query(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type,
            COUNT(r.repair_id)                 AS repair_count,
            COALESCE(SUM(r.downtime_hours), 0) AS total_downtime,
            COALESCE(AVG(r.downtime_hours), 0) AS average_downtime,
            COALESCE(MAX(r.downtime_hours), 0) AS longest_downtime
     FROM vehicles v
     LEFT JOIN repairs r ON r.vehicle_id = v.vehicle_id ${joinFilter}
     GROUP BY v.vehicle_id, v.vehicle_number, v.vehicle_type
     HAVING repair_count > 0
     ORDER BY total_downtime DESC`,
    params
  );

  res.status(200).json({
    success: true,
    data: rows,
    summary: {
      total_downtime: rows.reduce((s, r) => s + Number(r.total_downtime), 0),
      vehicles_affected: rows.length,
    },
  });
});

/** GET /api/reports/:name - dispatcher used by the frontend Reports page. */
const REPORTS = {
  'maintenance-history': maintenanceHistory,
  'repair-history': repairHistory,
  'maintenance-costs': maintenanceCosts,
  'repair-costs': repairCosts,
  'vehicle-utilisation': vehicleUtilisation,
  'fleet-availability': fleetAvailability,
  'upcoming-maintenance': upcomingMaintenance,
  'overdue-maintenance': overdueMaintenance,
  'repair-downtime': repairDowntime,
};

const runReport = asyncHandler(async (req, res, next) => {
  const handler = REPORTS[req.params.name];
  if (!handler) {
    throw new ApiError(
      404,
      `Unknown report '${req.params.name}'. Available: ${Object.keys(REPORTS).join(', ')}`
    );
  }
  return handler(req, res, next);
});

module.exports = {
  maintenanceHistory,
  repairHistory,
  maintenanceCosts,
  repairCosts,
  vehicleUtilisation,
  fleetAvailability,
  upcomingMaintenance,
  overdueMaintenance,
  repairDowntime,
  runReport,
  REPORTS,
};
