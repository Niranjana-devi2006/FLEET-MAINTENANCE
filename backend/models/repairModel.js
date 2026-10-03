const { query, execute } = require('../config/db');

const COLUMNS = [
  'vehicle_id', 'repair_date', 'problem_description', 'repair_description',
  'parts_replaced', 'repair_cost', 'downtime_hours', 'technician', 'status', 'remarks',
];

const SELECT_WITH_JOIN = `
  SELECT r.*, v.vehicle_number, v.vehicle_type, v.manufacturer, v.model,
         v.status AS vehicle_status
  FROM repairs r
  JOIN vehicles v ON v.vehicle_id = r.vehicle_id
`;

const ACTIVE_STATUSES = ['Open', 'In Progress'];

const RepairModel = {
  async findAll({ search, status, vehicle_id, technician, from, to, page = 1, limit = 50 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(r.problem_description LIKE ? OR r.repair_description LIKE ? OR r.parts_replaced LIKE ? OR v.vehicle_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      where.push('r.status = ?');
      params.push(status);
    }
    if (vehicle_id) {
      where.push('r.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (technician) {
      where.push('r.technician = ?');
      params.push(technician);
    }
    if (from) {
      where.push('r.repair_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('r.repair_date <= ?');
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await query(
      `${SELECT_WITH_JOIN} ${whereSql}
       ORDER BY r.repair_date DESC, r.repair_id DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM repairs r
       JOIN vehicles v ON v.vehicle_id = r.vehicle_id ${whereSql}`,
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
    const rows = await query(`${SELECT_WITH_JOIN} WHERE r.repair_id = ?`, [id]);
    return rows[0] || null;
  },

  async findByVehicle(vehicleId, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return query(
      `${SELECT_WITH_JOIN} WHERE r.vehicle_id = ?
       ORDER BY r.repair_date DESC LIMIT ${safeLimit}`,
      [vehicleId]
    );
  },

  async create(data, conn = null) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO repairs (${fields.join(', ')}) VALUES (${placeholders})`;
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
    const sql = `UPDATE repairs SET ${setClause} WHERE repair_id = ?`;
    const values = [...fields.map((f) => data[f]), id];

    if (conn) {
      await conn.execute(sql, values);
      return;
    }
    await execute(sql, values);
  },

  async remove(id) {
    const result = await execute('DELETE FROM repairs WHERE repair_id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Any still-open repair on this vehicle, ignoring `excludeId`. */
  async hasActiveRepair(vehicleId, excludeId = null, conn = null) {
    const params = [vehicleId];
    let sql = `SELECT COUNT(*) AS count FROM repairs
               WHERE vehicle_id = ? AND status IN ('Open','In Progress')`;
    if (excludeId) {
      sql += ' AND repair_id <> ?';
      params.push(excludeId);
    }
    if (conn) {
      const [rows] = await conn.execute(sql, params);
      return rows[0].count > 0;
    }
    const rows = await query(sql, params);
    return rows[0].count > 0;
  },

  async countOpen() {
    const rows = await query(
      "SELECT COUNT(*) AS total FROM repairs WHERE status IN ('Open','In Progress')"
    );
    return rows[0].total;
  },

  async countByStatus() {
    return query('SELECT status, COUNT(*) AS count FROM repairs GROUP BY status');
  },

  async totalCost({ from, to } = {}) {
    const where = [];
    const params = [];
    if (from) {
      where.push('repair_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('repair_date <= ?');
      params.push(to);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT COALESCE(SUM(repair_cost), 0) AS total FROM repairs ${whereSql}`,
      params
    );
    return rows[0].total;
  },

  async costByMonth(months = 12) {
    return query(
      `SELECT DATE_FORMAT(repair_date, '%Y-%m') AS month,
              COALESCE(SUM(repair_cost), 0)     AS total_cost,
              COALESCE(SUM(downtime_hours), 0)  AS total_downtime,
              COUNT(*)                          AS repair_count
       FROM repairs
       WHERE repair_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(repair_date, '%Y-%m')
       ORDER BY month ASC`,
      [Number(months) || 12]
    );
  },

  async downtimeByVehicle(months = 12) {
    return query(
      `SELECT v.vehicle_id, v.vehicle_number,
              COALESCE(SUM(r.downtime_hours), 0) AS total_downtime,
              COUNT(r.repair_id)                 AS repair_count,
              COALESCE(SUM(r.repair_cost), 0)    AS total_cost
       FROM vehicles v
       LEFT JOIN repairs r
         ON r.vehicle_id = v.vehicle_id
        AND r.repair_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY v.vehicle_id, v.vehicle_number
       HAVING total_downtime > 0
       ORDER BY total_downtime DESC`,
      [Number(months) || 12]
    );
  },

  async recent(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    return query(
      `${SELECT_WITH_JOIN} ORDER BY r.repair_date DESC, r.repair_id DESC LIMIT ${safeLimit}`
    );
  },

  /** Repair count per vehicle in a window - a forecasting risk input. */
  async repairFrequency(vehicleId, days = 365) {
    const rows = await query(
      `SELECT COUNT(*) AS repair_count,
              COALESCE(SUM(downtime_hours), 0) AS total_downtime
       FROM repairs
       WHERE vehicle_id = ? AND repair_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [vehicleId, Number(days) || 365]
    );
    return rows[0];
  },

  /** Long-running open repairs - feeds the "long downtime" alert. */
  async findLongDowntime(hoursThreshold = 48) {
    return query(
      `${SELECT_WITH_JOIN}
       WHERE r.status IN ('Open','In Progress') AND r.downtime_hours >= ?
       ORDER BY r.downtime_hours DESC`,
      [Number(hoursThreshold) || 48]
    );
  },

  async findActive() {
    return query(
      `${SELECT_WITH_JOIN} WHERE r.status IN ('Open','In Progress')
       ORDER BY r.repair_date DESC`
    );
  },

  async findAssignedTo(technicianName, { status } = {}) {
    const where = ['r.technician = ?'];
    const params = [technicianName];
    if (status) {
      where.push('r.status = ?');
      params.push(status);
    }
    return query(
      `${SELECT_WITH_JOIN} WHERE ${where.join(' AND ')}
       ORDER BY FIELD(r.status,'In Progress','Open','Completed','Cancelled'),
                r.repair_date DESC`,
      params
    );
  },

  ACTIVE_STATUSES,
};

module.exports = RepairModel;
