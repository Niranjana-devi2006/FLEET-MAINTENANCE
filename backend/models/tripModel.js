const { query, execute } = require('../config/db');

const COLUMNS = [
  'vehicle_id', 'driver_id', 'start_location', 'destination',
  'start_date', 'end_date', 'distance_km', 'fuel_consumed', 'trip_status',
];

const SELECT_WITH_JOINS = `
  SELECT t.*,
         v.vehicle_number, v.vehicle_type, v.manufacturer, v.model,
         d.name AS driver_name, d.license_number
  FROM trips t
  JOIN vehicles v ON v.vehicle_id = t.vehicle_id
  JOIN drivers  d ON d.driver_id  = t.driver_id
`;

const TripModel = {
  async findAll({ search, status, vehicle_id, driver_id, from, to, page = 1, limit = 50 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(t.start_location LIKE ? OR t.destination LIKE ? OR v.vehicle_number LIKE ? OR d.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      where.push('t.trip_status = ?');
      params.push(status);
    }
    if (vehicle_id) {
      where.push('t.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (driver_id) {
      where.push('t.driver_id = ?');
      params.push(driver_id);
    }
    if (from) {
      where.push('t.start_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('t.start_date <= ?');
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await query(
      `${SELECT_WITH_JOINS} ${whereSql}
       ORDER BY t.start_date DESC, t.trip_id DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM trips t
       JOIN vehicles v ON v.vehicle_id = t.vehicle_id
       JOIN drivers  d ON d.driver_id  = t.driver_id
       ${whereSql}`,
      params
    );

    return {
      rows,
      total: countRows[0].total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(Math.ceil(countRows[0].total / safeLimit), 1),
    };
  },

  async findById(id) {
    const rows = await query(`${SELECT_WITH_JOINS} WHERE t.trip_id = ?`, [id]);
    return rows[0] || null;
  },

  async findByVehicle(vehicleId, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    return query(
      `${SELECT_WITH_JOINS} WHERE t.vehicle_id = ?
       ORDER BY t.start_date DESC LIMIT ${safeLimit}`,
      [vehicleId]
    );
  },

  async create(data, conn = null) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO trips (${fields.join(', ')}) VALUES (${placeholders})`;
    const values = fields.map((f) => data[f]);

    if (conn) {
      const [result] = await conn.execute(sql, values);
      return result.insertId;
    }
    const result = await execute(sql, values);
    return result.insertId;
  },

  async update(id, data, conn = null) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE trips SET ${setClause} WHERE trip_id = ?`;
    const values = [...fields.map((f) => data[f]), id];

    if (conn) {
      await conn.execute(sql, values);
      return;
    }
    await execute(sql, values);
  },

  async remove(id, conn = null) {
    const sql = 'DELETE FROM trips WHERE trip_id = ?';
    if (conn) {
      const [result] = await conn.execute(sql, [id]);
      return result.affectedRows > 0;
    }
    const result = await execute(sql, [id]);
    return result.affectedRows > 0;
  },

  /** Does this vehicle have another active trip (excluding `excludeTripId`)? */
  async hasActiveTrip(vehicleId, excludeTripId = null) {
    const params = [vehicleId];
    let sql = `SELECT COUNT(*) AS count FROM trips
               WHERE vehicle_id = ? AND trip_status IN ('Ongoing','Scheduled')`;
    if (excludeTripId) {
      sql += ' AND trip_id <> ?';
      params.push(excludeTripId);
    }
    const rows = await query(sql, params);
    return rows[0].count > 0;
  },

  async driverHasActiveTrip(driverId, excludeTripId = null) {
    const params = [driverId];
    let sql = `SELECT COUNT(*) AS count FROM trips
               WHERE driver_id = ? AND trip_status IN ('Ongoing','Scheduled')`;
    if (excludeTripId) {
      sql += ' AND trip_id <> ?';
      params.push(excludeTripId);
    }
    const rows = await query(sql, params);
    return rows[0].count > 0;
  },

  /**
   * Total completed distance and the span of days it covers, per vehicle.
   * This is the raw input for the average-daily-distance calculation.
   */
  async getUsageStats(vehicleId, sinceDays = 180) {
    const rows = await query(
      `SELECT COALESCE(SUM(distance_km), 0) AS total_distance,
              COUNT(*)                       AS trip_count,
              MIN(start_date)                AS first_trip,
              MAX(COALESCE(end_date, start_date)) AS last_trip
       FROM trips
       WHERE vehicle_id = ?
         AND trip_status = 'Completed'
         AND start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [vehicleId, Number(sinceDays) || 180]
    );
    return rows[0];
  },

  async countByStatus() {
    return query('SELECT trip_status, COUNT(*) AS count FROM trips GROUP BY trip_status');
  },

  async recent(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    return query(
      `${SELECT_WITH_JOINS} ORDER BY t.start_date DESC, t.trip_id DESC LIMIT ${safeLimit}`
    );
  },

  /** Distance per vehicle over a window - drives the utilisation chart. */
  async utilisationByVehicle(days = 90) {
    return query(
      `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status,
              COALESCE(SUM(t.distance_km), 0) AS total_distance,
              COUNT(t.trip_id)                AS trip_count,
              COALESCE(SUM(t.fuel_consumed), 0) AS total_fuel,
              COALESCE(SUM(DATEDIFF(COALESCE(t.end_date, CURDATE()), t.start_date) + 1), 0) AS days_used
       FROM vehicles v
       LEFT JOIN trips t
         ON t.vehicle_id = v.vehicle_id
        AND t.trip_status = 'Completed'
        AND t.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY v.vehicle_id, v.vehicle_number, v.vehicle_type, v.status
       ORDER BY total_distance DESC`,
      [Number(days) || 90]
    );
  },

  /** Total fleet days occupied by completed trips in the window. */
  async fleetUtilisation(days = 30) {
    const rows = await query(
      `SELECT COALESCE(SUM(
                LEAST(DATEDIFF(COALESCE(end_date, CURDATE()), start_date) + 1, ?)
              ), 0) AS occupied_days
       FROM trips
       WHERE trip_status IN ('Completed','Ongoing')
         AND COALESCE(end_date, CURDATE()) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [Number(days) || 30, Number(days) || 30]
    );
    return rows[0].occupied_days;
  },
};

module.exports = TripModel;
