/**
 * JWT authentication.
 *
 * Reads `Authorization: Bearer <token>`, verifies it, and attaches the decoded
 * payload to `req.user` as { user_id, email, role, name }.
 */
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { ApiError } = require('./errorMiddleware');

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorised - no token provided');
    }

    const token = header.slice(7).trim();
    if (!token) throw new ApiError(401, 'Not authorised - no token provided');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Session expired - please log in again');
      }
      throw new ApiError(401, 'Not authorised - invalid token');
    }

    // Confirm the user still exists (and pick up a role change since issue).
    const rows = await query(
      'SELECT user_id, name, email, role, phone FROM users WHERE user_id = ?',
      [decoded.user_id]
    );
    if (rows.length === 0) {
      throw new ApiError(401, 'Not authorised - user no longer exists');
    }

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { protect, signToken };
