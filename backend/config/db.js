/**
 * MySQL connection pool.
 *
 * Every query in this project goes through `query()` or `transaction()` with
 * bound parameters, which is what keeps SQL injection off the table.
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fleet_maintenance',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // return DATE/DATETIME as 'YYYY-MM-DD' strings, not JS Dates
  decimalNumbers: true,
  multipleStatements: false,
});

/**
 * Run a parameterised query and return just the rows.
 * @param {string} sql
 * @param {Array} params
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run an INSERT/UPDATE/DELETE and return the raw result header
 * (insertId, affectedRows, ...).
 */
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Run `fn` inside a transaction, passing it a dedicated connection.
 * Rolls back on any thrown error.
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Verify the database is reachable at boot so failures are loud and early. */
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, execute, transaction, testConnection };
