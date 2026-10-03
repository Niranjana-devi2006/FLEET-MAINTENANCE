const { query, execute } = require('../config/db');

const COLUMNS = [
  'vehicle_id', 'maintenance_type', 'service_date', 'odometer_reading',
  'description', 'service_cost', 'next_service_date', 'next_service_odometer',
  'status', 'technician', 'remarks',
];

const SELECT_WITH_JOIN = `
  SELECT m.*, v.vehicle_number, v.vehicle_type, v.manufacturer, v.model,
         v.current_odometer, v.status AS vehicle_status
  FROM maintenance m
  JOIN vehicles v ON v.vehicle_id = m.vehicle_id
`;

const MaintenanceModel = {
  async findAll({ search, status, vehicle_id, type, technician, from, to, page = 1, limit = 50 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(m.maintenance_type LIKE ? OR m.description LIKE ? OR v.vehicle_number LIKE ? OR m.technician LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      where.push('m.status = ?');
      params.push(status);
    }
    if (vehicle_id) {
      where.push('m.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (type) {
      where.push('m.maintenance_type = ?');
      params.push(type);
    }
    if (technician) {
      where.push('m.technician = ?');
      params.push(technician);
    }
    if (from) {
      where.push('m.service_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('m.service_date <= ?');
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await query(
      `${SELECT_WITH_JOIN} ${whereSql}
       ORDER BY m.service_date DESC, m.maintenance_id DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM maintenance m
       JOIN vehicles v ON v.vehicle_id = m.vehicle_id ${whereSql}`,
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
    const rows = await query(`${SELECT_WITH_JOIN} WHERE m.maintenance_id = ?`, [id]);
    return rows[0] || null;
  },

  async findByVehicle(vehicleId, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return query(
      `${SELECT_WITH_JOIN} WHERE m.vehicle_id = ?
       ORDER BY m.service_date DESC LIMIT ${safeLimit}`,
      [vehicleId]
    );
  },

  /** Completed services, oldest first - the history the forecaster reads. */
  async findCompletedHistory(vehicleId) {
    return query(
      `SELECT maintenance_id, maintenance_type, service_date, odometer_reading,
              next_service_date, next_service_odometer, service_cost
       FROM maintenance
       WHERE vehicle_id = ? AND status = 'Completed'
       ORDER BY service_date ASC, odometer_reading ASC`,
      [vehicleId]
    );
  },

  async create(data, conn = null) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO maintenance (${fields.join(', ')}) VALUES (${placeholders})`;
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
    const sql = `UPDATE maintenance SET ${setClause} WHERE maintenance_id = ?`;
    const values = [...fields.map((f) => data[f]), id];

    if (conn) {
      await conn.execute(sql, values);
      return;
    }
    await execute(sql, values);
  },

  async remove(id) {
    const result = await execute('DELETE FROM maintenance WHERE maintenance_id = ?', [id]);
    return result.affectedRows > 0;
  },

  async countByStatus() {
    return query('SELECT status, COUNT(*) AS count FROM maintenance GROUP BY status');
  },

  async totalCost({ from, to } = {}) {
    const where = ["status = 'Completed'"];
    const params = [];
    if (from) {
      where.push('service_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('service_date <= ?');
      params.push(to);
    }
    const rows = await query(
      `SELECT COALESCE(SUM(service_cost), 0) AS total FROM maintenance WHERE ${where.join(' AND ')}`,
      params
    );
    return rows[0].total;
  },

  /** Monthly cost series for the dashboard chart. */
  async costByMonth(months = 12) {
    return query(
      `SELECT DATE_FORMAT(service_date, '%Y-%m') AS month,
              COALESCE(SUM(service_cost), 0)     AS total_cost,
              COUNT(*)                           AS service_count
       FROM maintenance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         AND status = 'Completed'
       GROUP BY DATE_FORMAT(service_date, '%Y-%m')
       ORDER BY month ASC`,
      [Number(months) || 12]
    );
  },

  /** How often each maintenance type occurs - frequency chart. */
  async frequencyByType(months = 12) {
    return query(
      `SELECT maintenance_type, COUNT(*) AS count,
              COALESCE(SUM(service_cost), 0) AS total_cost
       FROM maintenance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY maintenance_type
       ORDER BY count DESC`,
      [Number(months) || 12]
    );
  },

  async upcoming(days = 30, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return query(
      `${SELECT_WITH_JOIN}
       WHERE m.status IN ('Scheduled','In Progress')
         AND m.service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY m.service_date ASC
       LIMIT ${safeLimit}`,
      [Number(days) || 30]
    );
  },

  async countUpcoming(days = 30) {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM maintenance
       WHERE status IN ('Scheduled','In Progress')
         AND service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      [Number(days) || 30]
    );
    return rows[0].total;
  },

  async findDistinctTypes() {
    const rows = await query(
      'SELECT DISTINCT maintenance_type FROM maintenance ORDER BY maintenance_type'
    );
    return rows.map((r) => r.maintenance_type);
  },

  /** Open work assigned to one technician - the Technician role's queue. */
  async findAssignedTo(technicianName, { status } = {}) {
    const where = ['m.technician = ?'];
    const params = [technicianName];
    if (status) {
      where.push('m.status = ?');
      params.push(status);
    }
    return query(
      `${SELECT_WITH_JOIN} WHERE ${where.join(' AND ')}
       ORDER BY FIELD(m.status,'In Progress','Scheduled','Completed','Cancelled'),
                m.service_date ASC`,
      params
    );
  },
};

module.exports = MaintenanceModel;
