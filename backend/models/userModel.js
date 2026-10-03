const { query, execute } = require('../config/db');

const PUBLIC_FIELDS = 'user_id, name, email, role, phone, created_at';

const UserModel = {
  async findAll() {
    return query(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`);
  },

  async findById(id) {
    const rows = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE user_id = ?`, [id]);
    return rows[0] || null;
  },

  /** Includes the password hash - only for login/password-change flows. */
  async findByEmailWithPassword(email) {
    const rows = await query(
      'SELECT user_id, name, email, password, role, phone, created_at FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  },

  async findPasswordById(id) {
    const rows = await query('SELECT password FROM users WHERE user_id = ?', [id]);
    return rows[0] ? rows[0].password : null;
  },

  async create({ name, email, password, role = 'Fleet Manager', phone = null }) {
    const result = await execute(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, role, phone]
    );
    return this.findById(result.insertId);
  },

  async update(id, fields) {
    const allowed = ['name', 'email', 'role', 'phone', 'password'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    await execute(`UPDATE users SET ${setClause} WHERE user_id = ?`, [...values, id]);
    return this.findById(id);
  },

  async remove(id) {
    const result = await execute('DELETE FROM users WHERE user_id = ?', [id]);
    return result.affectedRows > 0;
  },

  async countByRole(role) {
    const rows = await query('SELECT COUNT(*) AS total FROM users WHERE role = ?', [role]);
    return rows[0].total;
  },
};

module.exports = UserModel;
