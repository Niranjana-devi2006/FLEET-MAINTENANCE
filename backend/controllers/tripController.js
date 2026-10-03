const { transaction } = require('../config/db');
const TripModel = require('../models/tripModel');
const VehicleModel = require('../models/vehicleModel');
const DriverModel = require('../models/driverModel');
const RepairModel = require('../models/repairModel');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

const ACTIVE_TRIP_STATUSES = ['Scheduled', 'Ongoing'];

/**
 * Decide what a vehicle's status should be once it is released from a trip.
 * A vehicle still under an open repair stays Under Maintenance.
 */
async function releasedVehicleStatus(vehicleId, conn) {
  const underRepair = await RepairModel.hasActiveRepair(vehicleId, null, conn);
  return underRepair ? 'Under Maintenance' : 'Available';
}

/** GET /api/trips */
const getTrips = asyncHandler(async (req, res) => {
  const { search, status, vehicle_id, driver_id, from, to, page, limit } = req.query;
  const result = await TripModel.findAll({
    search, status, vehicle_id, driver_id, from, to, page, limit,
  });
  res.status(200).json({
    success: true,
    data: result.rows,
    pagination: {
      total: result.total, page: result.page, limit: result.limit, pages: result.pages,
    },
  });
});

/** GET /api/trips/:id */
const getTripById = asyncHandler(async (req, res) => {
  const trip = await TripModel.findById(req.params.id);
  if (!trip) throw new ApiError(404, 'Trip not found');
  res.status(200).json({ success: true, data: trip });
});

/**
 * POST /api/trips
 *
 * Creating an active trip puts the vehicle On Trip and the driver On Trip.
 * Creating an already-completed trip immediately rolls the odometer forward.
 */
const createTrip = asyncHandler(async (req, res) => {
  const {
    vehicle_id: vehicleId,
    driver_id: driverId,
    distance_km: distanceKm = 0,
  } = req.body;
  const tripStatus = req.body.trip_status || 'Scheduled';

  const [vehicle, driver] = await Promise.all([
    VehicleModel.findById(vehicleId),
    DriverModel.findById(driverId),
  ]);
  if (!vehicle) throw new ApiError(404, 'Selected vehicle not found');
  if (!driver) throw new ApiError(404, 'Selected driver not found');

  if (ACTIVE_TRIP_STATUSES.includes(tripStatus)) {
    if (vehicle.status === 'Under Maintenance' || vehicle.status === 'Out of Service') {
      throw new ApiError(
        400,
        `${vehicle.vehicle_number} is ${vehicle.status} and cannot be assigned to a trip`
      );
    }
    const busy = await TripModel.hasActiveTrip(vehicleId);
    if (busy) {
      throw new ApiError(400, `${vehicle.vehicle_number} already has a scheduled or ongoing trip`);
    }
    const driverBusy = await TripModel.driverHasActiveTrip(driverId);
    if (driverBusy) {
      throw new ApiError(400, `${driver.name} is already assigned to another active trip`);
    }
    if (driver.status === 'Suspended' || driver.status === 'Inactive') {
      throw new ApiError(400, `${driver.name} is ${driver.status} and cannot be assigned a trip`);
    }
  }

  const tripId = await transaction(async (conn) => {
    const id = await TripModel.create(
      {
        vehicle_id: vehicleId,
        driver_id: driverId,
        start_location: req.body.start_location,
        destination: req.body.destination,
        start_date: req.body.start_date,
        end_date: req.body.end_date || null,
        distance_km: distanceKm,
        fuel_consumed: req.body.fuel_consumed ?? 0,
        trip_status: tripStatus,
      },
      conn
    );

    if (ACTIVE_TRIP_STATUSES.includes(tripStatus)) {
      await VehicleModel.updateStatus(vehicleId, 'On Trip', conn);
      await DriverModel.updateStatus(driverId, 'On Trip', conn);
    } else if (tripStatus === 'Completed') {
      // Trip logged after the fact - bank the distance straight away.
      await VehicleModel.addOdometer(vehicleId, distanceKm, conn);
    }

    return id;
  });

  const trip = await TripModel.findById(tripId);
  res.status(201).json({ success: true, data: trip });
});

/**
 * PUT /api/trips/:id
 *
 * Status transitions drive the vehicle and driver state:
 *   -> Ongoing/Scheduled : vehicle On Trip,   driver On Trip
 *   -> Completed         : vehicle released,  driver Active, odometer advanced
 *   -> Cancelled         : vehicle released,  driver Active, no odometer change
 */
const updateTrip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const trip = await TripModel.findById(id);
  if (!trip) throw new ApiError(404, 'Trip not found');

  const newStatus = req.body.trip_status || trip.trip_status;
  const vehicleId = req.body.vehicle_id ?? trip.vehicle_id;
  const driverId = req.body.driver_id ?? trip.driver_id;
  const newDistance = req.body.distance_km ?? Number(trip.distance_km);

  const wasCompleted = trip.trip_status === 'Completed';
  const nowCompleted = newStatus === 'Completed';

  // Guard: don't move a trip onto a vehicle that is off the road.
  if (ACTIVE_TRIP_STATUSES.includes(newStatus) && vehicleId !== trip.vehicle_id) {
    const target = await VehicleModel.findById(vehicleId);
    if (!target) throw new ApiError(404, 'Selected vehicle not found');
    if (target.status === 'Under Maintenance' || target.status === 'Out of Service') {
      throw new ApiError(
        400,
        `${target.vehicle_number} is ${target.status} and cannot be assigned to a trip`
      );
    }
  }

  if (nowCompleted && !req.body.end_date && !trip.end_date) {
    throw new ApiError(400, 'An end date is required to complete a trip');
  }

  await transaction(async (conn) => {
    await TripModel.update(id, req.body, conn);

    if (ACTIVE_TRIP_STATUSES.includes(newStatus)) {
      await VehicleModel.updateStatus(vehicleId, 'On Trip', conn);
      await DriverModel.updateStatus(driverId, 'On Trip', conn);

      // If the trip moved to a different vehicle, release the old one.
      if (vehicleId !== trip.vehicle_id) {
        const status = await releasedVehicleStatus(trip.vehicle_id, conn);
        await VehicleModel.updateStatus(trip.vehicle_id, status, conn);
      }
      // A previously completed trip being reopened gives back its distance.
      if (wasCompleted) {
        await VehicleModel.addOdometer(trip.vehicle_id, -Number(trip.distance_km), conn);
      }
    } else if (nowCompleted) {
      if (!wasCompleted) {
        // Advance the odometer exactly once, on the transition into Completed.
        await VehicleModel.addOdometer(vehicleId, newDistance, conn);
      } else if (newDistance !== Number(trip.distance_km)) {
        // Distance corrected on an already-completed trip - apply the delta.
        await VehicleModel.addOdometer(vehicleId, newDistance - Number(trip.distance_km), conn);
      }
      const status = await releasedVehicleStatus(vehicleId, conn);
      await VehicleModel.updateStatus(vehicleId, status, conn);
      await DriverModel.updateStatus(driverId, 'Active', conn);
    } else if (newStatus === 'Cancelled') {
      if (wasCompleted) {
        await VehicleModel.addOdometer(vehicleId, -Number(trip.distance_km), conn);
      }
      const status = await releasedVehicleStatus(vehicleId, conn);
      await VehicleModel.updateStatus(vehicleId, status, conn);
      await DriverModel.updateStatus(driverId, 'Active', conn);
    }
  });

  const updated = await TripModel.findById(id);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/trips/:id */
const deleteTrip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const trip = await TripModel.findById(id);
  if (!trip) throw new ApiError(404, 'Trip not found');

  await transaction(async (conn) => {
    await TripModel.remove(id, conn);

    if (ACTIVE_TRIP_STATUSES.includes(trip.trip_status)) {
      const status = await releasedVehicleStatus(trip.vehicle_id, conn);
      await VehicleModel.updateStatus(trip.vehicle_id, status, conn);
      await DriverModel.updateStatus(trip.driver_id, 'Active', conn);
    } else if (trip.trip_status === 'Completed') {
      // Removing a completed trip removes the distance it contributed.
      await VehicleModel.addOdometer(trip.vehicle_id, -Number(trip.distance_km), conn);
    }
  });

  res.status(200).json({ success: true, data: { message: 'Trip deleted successfully' } });
});

module.exports = { getTrips, getTripById, createTrip, updateTrip, deleteTrip };
