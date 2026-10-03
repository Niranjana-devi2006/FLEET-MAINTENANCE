const { query, execute } = require('../config/db');

const SELECT_WITH_JOIN = `
  SELECT f.*, v.vehicle_number, v.vehicle_type, v.manufacturer, v.model,
         v.current_odometer, v.status AS vehicle_status, v.last_service_date
  FROM maintenance_forecast f
  JOIN vehicles v ON v.vehicle_id = f.vehicle_id
`;

const RISK_ORDER = "FIELD(f.risk_level,'CRITICAL','HIGH','MEDIUM','LOW')";

const ForecastModel = {
  /** Latest forecast row per vehicle, newest generation wins. */
  async findLatest({ risk_level, vehicle_id } = {}) {
    const where = [
      `f.forecast_id IN (
         SELECT MAX(forecast_id) FROM maintenance_forecast GROUP BY vehicle_id
       )`,
    ];
    const params = [];
    if (risk_level) {
      where.push('f.risk_level = ?');
      params.push(risk_level);
    }
    if (vehicle_id) {
      where.push('f.vehicle_id = ?');
      params.push(vehicle_id);
    }
    return query(
      `${SELECT_WITH_JOIN} WHERE ${where.join(' AND ')}
       ORDER BY ${RISK_ORDER}, f.predicted_service_date ASC`,
      params
    );
  },

  /** Full forecast history for one vehicle. */
  async findByVehicle(vehicleId, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return query(
      `${SELECT_WITH_JOIN} WHERE f.vehicle_id = ?
       ORDER BY f.generated_date DESC LIMIT ${safeLimit}`,
      [vehicleId]
    );
  },

  async findLatestForVehicle(vehicleId) {
    const rows = await query(
      `${SELECT_WITH_JOIN} WHERE f.vehicle_id = ?
       ORDER BY f.generated_date DESC, f.forecast_id DESC LIMIT 1`,
      [vehicleId]
    );
    return rows[0] || null;
  },

  async create(data, conn = null) {
    const sql = `INSERT INTO maintenance_forecast
      (vehicle_id, predicted_service_date, predicted_odometer, maintenance_type,
       risk_level, reason, avg_daily_km, days_until_service)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      data.vehicle_id,
      data.predicted_service_date,
      data.predicted_odometer,
      data.maintenance_type,
      data.risk_level,
      data.reason,
      data.avg_daily_km,
      data.days_until_service,
    ];
    if (conn) {
      const [result] = await conn.execute(sql, values);
      return result.insertId;
    }
    const result = await execute(sql, values);
    return result.insertId;
  },

  /** Clear previous forecasts before a regeneration run. */
  async clearAll(conn = null) {
    const sql = 'DELETE FROM maintenance_forecast';
    if (conn) {
      await conn.execute(sql);
      return;
    }
    await execute(sql);
  },

  async clearForVehicle(vehicleId, conn = null) {
    const sql = 'DELETE FROM maintenance_forecast WHERE vehicle_id = ?';
    if (conn) {
      await conn.execute(sql, [vehicleId]);
      return;
    }
    await execute(sql, [vehicleId]);
  },

  async countByRisk() {
    return query(
      `SELECT risk_level, COUNT(*) AS count
       FROM maintenance_forecast
       WHERE forecast_id IN (
         SELECT MAX(forecast_id) FROM maintenance_forecast GROUP BY vehicle_id
       )
       GROUP BY risk_level`
    );
  },

  async countCritical() {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM maintenance_forecast
       WHERE risk_level IN ('CRITICAL','HIGH')
         AND forecast_id IN (
           SELECT MAX(forecast_id) FROM maintenance_forecast GROUP BY vehicle_id
         )`
    );
    return rows[0].total;
  },

  async lastGeneratedAt() {
    const rows = await query(
      'SELECT MAX(generated_date) AS generated_at FROM maintenance_forecast'
    );
    return rows[0].generated_at;
  },
};

module.exports = ForecastModel;
