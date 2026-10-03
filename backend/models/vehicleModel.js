const { query, execute } = require('../config/db');

const COLUMNS = [
  'vehicle_number', 'vehicle_type', 'manufacturer', 'model',
  'purchase_date', 'registration_date', 'current_odometer', 'fuel_type',
  'status', 'last_service_date', 'next_service_date',
];

const VehicleModel = {
  /**
   * Paginated + filtered list.
   * @param {{search?:string,status?:string,type?:string,page?:number,limit?:number}} opts
   */
  async findAll({ search, status, type, page = 1, limit = 50 } = {}) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(vehicle_number LIKE ? OR manufacturer LIKE ? OR model LIKE ? OR vehicle_type LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (type) {
      where.push('vehicle_type = ?');
      params.push(type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await query(
      `SELECT * FROM vehicles ${whereSql}
       ORDER BY vehicle_number ASC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM vehicles ${whereSql}`,
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

  /** Unpaginated list for dropdowns. */
  async findAllBasic() {
    return query(
      `SELECT vehicle_id, vehicle_number, vehicle_type, manufacturer, model,
              status, current_odometer
       FROM vehicles ORDER BY vehicle_number ASC`
    );
  },

  async findById(id) {
    const rows = await query('SELECT * FROM vehicles WHERE vehicle_id = ?', [id]);
    return rows[0] || null;
  },

  async findByNumber(vehicleNumber) {
    const rows = await query('SELECT * FROM vehicles WHERE vehicle_number = ?', [vehicleNumber]);
    return rows[0] || null;
  },

  async create(data) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => data[f]);
    const result = await execute(
      `INSERT INTO vehicles (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = COLUMNS.filter((c) => data[c] !== undefined);
    if (fields.length === 0) return this.findById(id);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f]);
    await execute(`UPDATE vehicles SET ${setClause} WHERE vehicle_id = ?`, [...values, id]);
    return this.findById(id);
  },

  async updateStatus(id, status, conn = null) {
    const sql = 'UPDATE vehicles SET status = ? WHERE vehicle_id = ?';
    if (conn) {
      await conn.execute(sql, [status, id]);
      return;
    }
    await execute(sql, [status, id]);
  },

  /**
   * Applies a signed distance delta to the odometer. Positive when a trip is
   * completed, negative when a completed trip is reopened, corrected or
   * deleted. GREATEST keeps the column at or above zero.
   */
  async addOdometer(id, km, conn = null) {
    const sql = `UPDATE vehicles
                 SET current_odometer = GREATEST(current_odometer + ?, 0)
                 WHERE vehicle_id = ?`;
    const delta = Math.round(Number(km) || 0);
    if (conn) {
      await conn.execute(sql, [delta, id]);
      return;
    }
    await execute(sql, [delta, id]);
  },

  async remove(id) {
    const result = await execute('DELETE FROM vehicles WHERE vehicle_id = ?', [id]);
    return result.affectedRows > 0;
  },

  async countByStatus() {
    return query('SELECT status, COUNT(*) AS count FROM vehicles GROUP BY status');
  },

  async countAll() {
    const rows = await query('SELECT COUNT(*) AS total FROM vehicles');
    return rows[0].total;
  },

  /** Vehicles whose next_service_date has passed or lands within `days`. */
  async findRequiringService(days = 30) {
    return query(
      `SELECT vehicle_id, vehicle_number, vehicle_type, manufacturer, model, status,
              current_odometer, last_service_date, next_service_date,
              DATEDIFF(next_service_date, CURDATE()) AS days_remaining
       FROM vehicles
       WHERE next_service_date IS NOT NULL
         AND next_service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY next_service_date ASC`,
      [Number(days) || 30]
    );
  },

  async findDistinctTypes() {
    const rows = await query('SELECT DISTINCT vehicle_type FROM vehicles ORDER BY vehicle_type');
    return rows.map((r) => r.vehicle_type);
  },
};

module.exports = VehicleModel;
