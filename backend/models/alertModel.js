const { query, execute } = require('../config/db');

const SELECT_WITH_JOIN = `
  SELECT a.*, v.vehicle_number, v.vehicle_type, v.status AS vehicle_status
  FROM alerts a
  LEFT JOIN vehicles v ON v.vehicle_id = a.vehicle_id
`;

const PRIORITY_ORDER = "FIELD(a.priority,'Critical','High','Medium','Low')";

const AlertModel = {
  async findAll({ status, priority, vehicle_id, type, limit = 100 } = {}) {
    const where = [];
    const params = [];

    if (status) {
      where.push('a.status = ?');
      params.push(status);
    }
    if (priority) {
      where.push('a.priority = ?');
      params.push(priority);
    }
    if (vehicle_id) {
      where.push('a.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (type) {
      where.push('a.alert_type = ?');
      params.push(type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    return query(
      `${SELECT_WITH_JOIN} ${whereSql}
       ORDER BY ${PRIORITY_ORDER}, a.alert_date DESC
       LIMIT ${safeLimit}`,
      params
    );
  },

  async findById(id) {
    const rows = await query(`${SELECT_WITH_JOIN} WHERE a.alert_id = ?`, [id]);
    return rows[0] || null;
  },

  async findByVehicle(vehicleId, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return query(
      `${SELECT_WITH_JOIN} WHERE a.vehicle_id = ?
       ORDER BY ${PRIORITY_ORDER}, a.alert_date DESC LIMIT ${safeLimit}`,
      [vehicleId]
    );
  },

  async create({ vehicle_id = null, alert_type, alert_message, priority = 'Low', status = 'Unread' }, conn = null) {
    const sql = `INSERT INTO alerts (vehicle_id, alert_type, alert_message, priority, status)
                 VALUES (?, ?, ?, ?, ?)`;
    const values = [vehicle_id, alert_type, alert_message, priority, status];
    if (conn) {
      const [result] = await conn.execute(sql, values);
      return result.insertId;
    }
    const result = await execute(sql, values);
    return result.insertId;
  },

  async markRead(id) {
    const result = await execute(
      "UPDATE alerts SET status = 'Read' WHERE alert_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  },

  async markAllRead() {
    const result = await execute("UPDATE alerts SET status = 'Read' WHERE status = 'Unread'");
    return result.affectedRows;
  },

  async updateStatus(id, status) {
    const result = await execute('UPDATE alerts SET status = ? WHERE alert_id = ?', [status, id]);
    return result.affectedRows > 0;
  },

  async remove(id) {
    const result = await execute('DELETE FROM alerts WHERE alert_id = ?', [id]);
    return result.affectedRows > 0;
  },

  /**
   * Remove auto-generated alerts before a regeneration pass, preserving any
   * alert an operator has already resolved.
   */
  async clearGenerated(conn = null) {
    const sql = "DELETE FROM alerts WHERE status <> 'Resolved'";
    if (conn) {
      await conn.execute(sql);
      return;
    }
    await execute(sql);
  },

  /** Does an equivalent unresolved alert already exist? Prevents duplicates. */
  async exists(vehicleId, alertType, conn = null) {
    const sql = `SELECT COUNT(*) AS count FROM alerts
                 WHERE vehicle_id <=> ? AND alert_type = ? AND status <> 'Resolved'`;
    if (conn) {
      const [rows] = await conn.execute(sql, [vehicleId, alertType]);
      return rows[0].count > 0;
    }
    const rows = await query(sql, [vehicleId, alertType]);
    return rows[0].count > 0;
  },

  async countUnread() {
    const rows = await query("SELECT COUNT(*) AS total FROM alerts WHERE status = 'Unread'");
    return rows[0].total;
  },

  async countCritical() {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM alerts
       WHERE priority IN ('Critical','High') AND status <> 'Resolved'`
    );
    return rows[0].total;
  },

  async countByPriority() {
    return query(
      `SELECT priority, COUNT(*) AS count FROM alerts
       WHERE status <> 'Resolved' GROUP BY priority`
    );
  },
};

module.exports = AlertModel;
