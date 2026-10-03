/**
 * Shared express-validator chains and helpers.
 *
 * `runValidation` turns collected validation errors into a 400 response in the
 * standard { success, message, errors } shape.
 */
const { body, param, query: q, validationResult } = require('express-validator');
const { ApiError } = require('../middleware/errorMiddleware');

function runValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return next(new ApiError(400, errors[0].message, errors));
  }
  next();
}

const VEHICLE_STATUSES = ['Available', 'On Trip', 'Under Maintenance', 'Out of Service'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
const DRIVER_STATUSES = ['Active', 'On Trip', 'Inactive', 'Suspended'];
const TRIP_STATUSES = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const MAINTENANCE_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const REPAIR_STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const ROLES = ['Admin', 'Fleet Manager', 'Technician'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const idParam = (name = 'id') =>
  param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`).toInt();

// --- auth ------------------------------------------------------------------
const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6, max: 72 })
    .withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 })
    .withMessage('Phone must be 20 characters or fewer'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// --- vehicles --------------------------------------------------------------
const vehicleRules = (isUpdate = false) => {
  const opt = isUpdate ? { optional: true } : {};
  const maybe = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    maybe(
      body('vehicle_number').trim().isLength({ min: 3, max: 30 })
        .withMessage('Vehicle number is required (3-30 characters)')
    ),
    maybe(
      body('vehicle_type').trim().isLength({ min: 2, max: 50 })
        .withMessage('Vehicle type is required')
    ),
    maybe(
      body('manufacturer').trim().isLength({ min: 1, max: 80 })
        .withMessage('Manufacturer is required')
    ),
    maybe(body('model').trim().isLength({ min: 1, max: 80 }).withMessage('Model is required')),
    body('purchase_date').optional({ values: 'null' }).isISO8601()
      .withMessage('Purchase date must be a valid date'),
    body('registration_date').optional({ values: 'null' }).isISO8601()
      .withMessage('Registration date must be a valid date'),
    body('current_odometer').optional(opt).isInt({ min: 0 })
      .withMessage('Odometer cannot be negative').toInt(),
    body('fuel_type').optional().isIn(FUEL_TYPES)
      .withMessage(`Fuel type must be one of: ${FUEL_TYPES.join(', ')}`),
    body('status').optional().isIn(VEHICLE_STATUSES)
      .withMessage(`Status must be one of: ${VEHICLE_STATUSES.join(', ')}`),
    body('last_service_date').optional({ values: 'null' }).isISO8601()
      .withMessage('Last service date must be a valid date'),
    body('next_service_date').optional({ values: 'null' }).isISO8601()
      .withMessage('Next service date must be a valid date'),
  ];
};

// --- drivers ---------------------------------------------------------------
const driverRules = (isUpdate = false) => {
  const maybe = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    maybe(body('name').trim().isLength({ min: 2, max: 100 })
      .withMessage('Driver name must be 2-100 characters')),
    maybe(body('license_number').trim().isLength({ min: 3, max: 40 })
      .withMessage('License number is required (3-40 characters)')),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 })
      .withMessage('Phone must be 20 characters or fewer'),
    body('license_expiry').optional({ values: 'null' }).isISO8601()
      .withMessage('License expiry must be a valid date'),
    body('status').optional().isIn(DRIVER_STATUSES)
      .withMessage(`Status must be one of: ${DRIVER_STATUSES.join(', ')}`),
  ];
};

// --- trips -----------------------------------------------------------------
const tripRules = (isUpdate = false) => {
  const maybe = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    maybe(body('vehicle_id').isInt({ min: 1 }).withMessage('A vehicle must be selected').toInt()),
    maybe(body('driver_id').isInt({ min: 1 }).withMessage('A driver must be selected').toInt()),
    maybe(body('start_location').trim().isLength({ min: 1, max: 120 })
      .withMessage('Start location is required')),
    maybe(body('destination').trim().isLength({ min: 1, max: 120 })
      .withMessage('Destination is required')),
    maybe(body('start_date').isISO8601().withMessage('Start date must be a valid date')),
    body('end_date').optional({ values: 'null' }).isISO8601()
      .withMessage('End date must be a valid date'),
    body('distance_km').optional().isFloat({ min: 0 })
      .withMessage('Distance cannot be negative').toFloat(),
    body('fuel_consumed').optional().isFloat({ min: 0 })
      .withMessage('Fuel consumed cannot be negative').toFloat(),
    body('trip_status').optional().isIn(TRIP_STATUSES)
      .withMessage(`Trip status must be one of: ${TRIP_STATUSES.join(', ')}`),
    body().custom((value) => {
      if (value.start_date && value.end_date && value.end_date < value.start_date) {
        throw new Error('End date cannot be before the start date');
      }
      return true;
    }),
  ];
};

// --- maintenance -----------------------------------------------------------
const maintenanceRules = (isUpdate = false) => {
  const maybe = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    maybe(body('vehicle_id').isInt({ min: 1 }).withMessage('A vehicle must be selected').toInt()),
    maybe(body('maintenance_type').trim().isLength({ min: 2, max: 80 })
      .withMessage('Maintenance type is required')),
    maybe(body('service_date').isISO8601().withMessage('Service date must be a valid date')),
    body('odometer_reading').optional().isInt({ min: 0 })
      .withMessage('Odometer reading cannot be negative').toInt(),
    body('service_cost').optional().isFloat({ min: 0 })
      .withMessage('Maintenance cost cannot be negative').toFloat(),
    body('next_service_date').optional({ values: 'null' }).isISO8601()
      .withMessage('Next service date must be a valid date'),
    body('next_service_odometer').optional({ values: 'null' }).isInt({ min: 0 })
      .withMessage('Next service odometer cannot be negative').toInt(),
    body('status').optional().isIn(MAINTENANCE_STATUSES)
      .withMessage(`Status must be one of: ${MAINTENANCE_STATUSES.join(', ')}`),
    body('description').optional({ values: 'null' }).trim().isLength({ max: 500 })
      .withMessage('Description is too long (max 500 characters)'),
    body('technician').optional({ values: 'null' }).trim().isLength({ max: 100 })
      .withMessage('Technician name is too long'),
    body('remarks').optional({ values: 'null' }).trim().isLength({ max: 500 })
      .withMessage('Remarks are too long (max 500 characters)'),
  ];
};

// --- repairs ---------------------------------------------------------------
const repairRules = (isUpdate = false) => {
  const maybe = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    maybe(body('vehicle_id').isInt({ min: 1 }).withMessage('A vehicle must be selected').toInt()),
    maybe(body('repair_date').isISO8601().withMessage('Repair date must be a valid date')),
    maybe(body('problem_description').trim().isLength({ min: 3, max: 500 })
      .withMessage('Problem description is required')),
    body('repair_description').optional({ values: 'null' }).trim().isLength({ max: 500 })
      .withMessage('Repair description is too long'),
    body('parts_replaced').optional({ values: 'null' }).trim().isLength({ max: 500 })
      .withMessage('Parts replaced is too long'),
    body('repair_cost').optional().isFloat({ min: 0 })
      .withMessage('Repair cost cannot be negative').toFloat(),
    body('downtime_hours').optional().isFloat({ min: 0 })
      .withMessage('Downtime hours cannot be negative').toFloat(),
    body('technician').optional({ values: 'null' }).trim().isLength({ max: 100 })
      .withMessage('Technician name is too long'),
    body('status').optional().isIn(REPAIR_STATUSES)
      .withMessage(`Status must be one of: ${REPAIR_STATUSES.join(', ')}`),
    body('remarks').optional({ values: 'null' }).trim().isLength({ max: 500 })
      .withMessage('Remarks are too long'),
  ];
};

// --- users (admin management) ---------------------------------------------
const userUpdateRules = [
  body('name').optional().trim().isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('email').optional().trim().isEmail().withMessage('A valid email address is required')
    .normalizeEmail(),
  body('role').optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 })
    .withMessage('Phone must be 20 characters or fewer'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 6, max: 72 })
    .withMessage('Password must be at least 6 characters'),
];

// --- shared list filters ---------------------------------------------------
const listRules = [
  q('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  q('limit').optional().isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200').toInt(),
  q('from').optional({ values: 'falsy' }).isISO8601().withMessage('`from` must be a valid date'),
  q('to').optional({ values: 'falsy' }).isISO8601().withMessage('`to` must be a valid date'),
];

module.exports = {
  runValidation,
  idParam,
  registerRules,
  loginRules,
  vehicleRules,
  driverRules,
  tripRules,
  maintenanceRules,
  repairRules,
  userUpdateRules,
  listRules,
  VEHICLE_STATUSES,
  FUEL_TYPES,
  DRIVER_STATUSES,
  TRIP_STATUSES,
  MAINTENANCE_STATUSES,
  REPAIR_STATUSES,
  ROLES,
  PRIORITIES,
};
