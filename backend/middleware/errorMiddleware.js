/**
 * Centralised error handling.
 *
 * Every response in the API is either
 *   { success: true,  data: ... }
 * or
 *   { success: false, message: '...' , errors?: [...] }
 */

class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Wraps async route handlers so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  const errors = err.errors || undefined;

  // Translate common MySQL errors into meaningful HTTP responses.
  switch (err.code) {
    case 'ER_DUP_ENTRY': {
      statusCode = 400;
      const field = /for key '(.+?)'/.exec(err.sqlMessage || '');
      message = field
        ? `Duplicate value - a record with this ${friendlyKey(field[1])} already exists`
        : 'Duplicate value - this record already exists';
      break;
    }
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      statusCode = 400;
      message = 'Related record not found - check the referenced vehicle or driver';
      break;
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      statusCode = 400;
      message = 'Cannot delete - other records still reference this item';
      break;
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      statusCode = 400;
      message = 'Value rejected by a database constraint - check for negative or invalid values';
      break;
    case 'ER_BAD_NULL_ERROR':
      statusCode = 400;
      message = 'A required field was left empty';
      break;
    case 'ECONNREFUSED':
    case 'ER_ACCESS_DENIED_ERROR':
      statusCode = 500;
      message = 'Database connection failed - check your .env database settings';
      break;
    default:
      break;
  }

  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(process.env.NODE_ENV === 'development' && statusCode === 500
      ? { stack: err.stack }
      : {}),
  });
}

function friendlyKey(key) {
  if (key.includes('email')) return 'email address';
  if (key.includes('vehicle_number')) return 'vehicle number';
  if (key.includes('license_number')) return 'license number';
  if (key.includes('service_name')) return 'service name';
  return 'value';
}

module.exports = { ApiError, asyncHandler, notFound, errorHandler };
