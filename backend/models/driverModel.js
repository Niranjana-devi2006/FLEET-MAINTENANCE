const { query, execute } = require('../config/db');

const COLUMNS = ['name', 'license_number', 'phone', 'license_expiry', 'status'];

const DriverModel = {
  async findAll({ search, status, page = 1, limit = 50 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(name LIKE ? OR license_number LIKE ? OR phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await query(
      `SELECT d.*,
              DATEDIFF(d.license_expiry, CURDATE()) AS license_days_remaining,
              (SELECT COUNT(*) FROM trips t WHERE t.driver_id = d.driver_id) AS total_trips
       FROM drivers d
       ${whereSql}
       ORDER BY d.name ASC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    const countRows = await query(`SELECT COUNT(*) AS total FROM drivers d ${whereSql}`, params);

    return {
      rows,
      total: countRows[0].total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(Math.ceil(countRows[0].total / safeLimit), 1),
    };
  },

  async findAllBasic() {
    return query(
      'SELECT driver_id, name, license_number, status FROM drivers ORDER BY name ASC'
    );
  },

  async findById(id) {
    const rows = await query(
      `SELECT d.*, DATEDIFF(d.license_expiry, CURDATE()) AS license_days_remaining
       FROM drivers d WHERE d.driver_id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const result = await execute(
      `INSERT INTO drivers (${fields.join(', ')}) VALUES (${placeholders})`,
      fields.map((f) => data[f])
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    if (fields.length === 0) return this.findById(id);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    await execute(
      `UPDATE drivers SET ${setClause} WHERE driver_id = ?`,
      [...fields.map((f) => data[f]), id]
    );
    return this.findById(id);
  },

  async updateStatus(id, status, conn = null) {
    const sql = 'UPDATE drivers SET status = ? WHERE driver_id = ?';
    if (conn) {
      await conn.execute(sql, [status, id]);
      return;
    }
    await execute(sql, [status, id]);
  },

  async remove(id) {
    const result = await execute('DELETE FROM drivers WHERE driver_id = ?', [id]);
    return result.affectedRows > 0;
  },

  /** Licences already expired or expiring within `days`. Feeds the alert service. */
  async findExpiringLicenses(days = 30) {
    return query(
      `SELECT driver_id, name, license_number, license_expiry, status,
              DATEDIFF(license_expiry, CURDATE()) AS days_remaining
       FROM drivers
       WHERE license_expiry IS NOT NULL
         AND license_expiry <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY license_expiry ASC`,
      [Number(days) || 30]
    );
  },

  async countAll() {
    const rows = await query('SELECT COUNT(*) AS total FROM drivers');
    return rows[0].total;
  },
};

module.exports = DriverModel;
