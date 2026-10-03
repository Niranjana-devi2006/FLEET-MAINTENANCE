const DriverModel = require('../models/driverModel');
const TripModel = require('../models/tripModel');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

/** GET /api/drivers */
const getDrivers = asyncHandler(async (req, res) => {
  const { search, status, page, limit, basic } = req.query;

  if (basic === 'true') {
    const rows = await DriverModel.findAllBasic();
    return res.status(200).json({ success: true, data: rows });
  }

  const result = await DriverModel.findAll({ search, status, page, limit });
  res.status(200).json({
    success: true,
    data: result.rows,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    },
  });
});

/** GET /api/drivers/:id */
const getDriverById = asyncHandler(async (req, res) => {
  const driver = await DriverModel.findById(req.params.id);
  if (!driver) throw new ApiError(404, 'Driver not found');

  const trips = await TripModel.findAll({ driver_id: req.params.id, limit: 25 });
  res.status(200).json({ success: true, data: { driver, trips: trips.rows } });
});

/** POST /api/drivers */
const createDriver = asyncHandler(async (req, res) => {
  const driver = await DriverModel.create({
    name: req.body.name,
    license_number: req.body.license_number,
    phone: req.body.phone || null,
    license_expiry: req.body.license_expiry || null,
    status: req.body.status || 'Active',
  });
  res.status(201).json({ success: true, data: driver });
});

/** PUT /api/drivers/:id */
const updateDriver = asyncHandler(async (req, res) => {
  const driver = await DriverModel.findById(req.params.id);
  if (!driver) throw new ApiError(404, 'Driver not found');

  const updated = await DriverModel.update(req.params.id, req.body);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/drivers/:id */
const deleteDriver = asyncHandler(async (req, res) => {
  const driver = await DriverModel.findById(req.params.id);
  if (!driver) throw new ApiError(404, 'Driver not found');

  const active = await TripModel.driverHasActiveTrip(req.params.id);
  if (active) {
    throw new ApiError(400, 'Cannot delete a driver assigned to a scheduled or ongoing trip');
  }

  try {
    await DriverModel.remove(req.params.id);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(
        400,
        'Cannot delete this driver - trip history references them. Set the driver to Inactive instead.'
      );
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    data: { message: `Driver ${driver.name} deleted successfully` },
  });
});

/** GET /api/drivers/expiring/licenses */
const getExpiringLicenses = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 30;
  const rows = await DriverModel.findExpiringLicenses(days);
  res.status(200).json({ success: true, data: rows });
});

module.exports = {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getExpiringLicenses,
};
