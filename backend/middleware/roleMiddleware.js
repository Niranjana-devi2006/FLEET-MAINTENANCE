/**
 * Role-based authorisation. Use after `protect`.
 *
 *   router.post('/', protect, authorise('Admin', 'Fleet Manager'), handler)
 */
const { ApiError } = require('./errorMiddleware');

const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Fleet Manager',
  TECHNICIAN: 'Technician',
};

function authorise(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorised - authentication required'));
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied - this action requires: ${allowedRoles.join(' or ')}`)
      );
    }
    next();
  };
}

module.exports = { authorise, ROLES };
