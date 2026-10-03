/**
 * Maintenance forecasting service.
 *
 * The forecast is derived entirely from data already in the database - trip
 * history, completed maintenance history, current odometer and repair
 * frequency. Nothing here is random.
 *
 * For each vehicle:
 *
 *   1. Average daily distance
 *        avg_daily_km = total completed trip distance / days in the window
 *      Falls back to lifetime odometer / vehicle age when trip history is thin.
 *
 *   2. Service interval
 *        Taken from `service_types` for the vehicle's usual maintenance type.
 *        If the vehicle's own history shows a different real-world cadence,
 *        the observed average distance between services is blended in.
 *
 *   3. Predicted service odometer
 *        predicted_odometer = last_service_odometer + service_interval_km
 *
 *   4. Days until service (kilometre-based)
 *        (predicted_odometer - current_odometer) / avg_daily_km
 *
 *   5. Days until service (calendar-based)
 *        (last_service_date + service_interval_days) - today
 *
 *   6. The binding constraint is whichever comes first.
 *        predicted_service_date = today + days_until_service
 *
 *   7. Risk level
 *        overdue            -> CRITICAL
 *        due within 15 days -> HIGH
 *        due within 30 days -> MEDIUM
 *        otherwise          -> LOW
 *      A vehicle with a heavy recent repair record is escalated one level.
 */
const { query, transaction } = require('../config/db');
const ForecastModel = require('../models/forecastModel');

// Tunables -------------------------------------------------------------------
const TRIP_WINDOW_DAYS = 180;      // how far back to look for usage
const REPAIR_WINDOW_DAYS = 365;    // how far back to look for repair frequency
const REPAIR_ESCALATION_THRESHOLD = 3; // repairs in window that bump risk a level
const DEFAULT_INTERVAL_KM = 10000;
const DEFAULT_INTERVAL_DAYS = 180;
const MIN_AVG_DAILY_KM = 1;        // avoid divide-by-zero on idle vehicles
const MAX_HORIZON_DAYS = 3650;     // cap absurd projections at ~10 years

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function escalate(risk, steps = 1) {
  const idx = RISK_LEVELS.indexOf(risk);
  return RISK_LEVELS[Math.min(idx + steps, RISK_LEVELS.length - 1)];
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

/** Look up the km/day intervals configured for each service type. */
async function loadServiceTypes() {
  const rows = await query(
    'SELECT service_name, service_interval_km, service_interval_days FROM service_types'
  );
  const map = new Map();
  rows.forEach((r) => map.set(r.service_name, r));
  return map;
}

/**
 * Gather every input the algorithm needs for one vehicle in a single pass.
 */
async function collectVehicleData(vehicle) {
  const [usage, history, repairs] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(distance_km), 0) AS total_distance,
              COUNT(*)                       AS trip_count,
              MIN(start_date)                AS first_trip,
              MAX(COALESCE(end_date, start_date)) AS last_trip
       FROM trips
       WHERE vehicle_id = ? AND trip_status = 'Completed'
         AND start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [vehicle.vehicle_id, TRIP_WINDOW_DAYS]
    ),
    query(
      `SELECT maintenance_type, service_date, odometer_reading,
              next_service_date, next_service_odometer
       FROM maintenance
       WHERE vehicle_id = ? AND status = 'Completed'
       ORDER BY service_date ASC, odometer_reading ASC`,
      [vehicle.vehicle_id]
    ),
    query(
      `SELECT COUNT(*) AS repair_count, COALESCE(SUM(downtime_hours), 0) AS total_downtime
       FROM repairs
       WHERE vehicle_id = ? AND repair_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [vehicle.vehicle_id, REPAIR_WINDOW_DAYS]
    ),
  ]);

  return { usage: usage[0], history, repairs: repairs[0] };
}

/**
 * Step 1: average daily distance.
 * Prefers observed trip data; falls back to lifetime usage since purchase.
 */
function computeAvgDailyKm(vehicle, usage) {
  const totalDistance = Number(usage.total_distance) || 0;

  if (totalDistance > 0 && usage.first_trip) {
    // Span the trips actually cover, floored at 1 day.
    const span = Math.max(daysBetween(usage.first_trip, toDateString(new Date())), 1);
    const avg = totalDistance / span;
    if (avg >= MIN_AVG_DAILY_KM) {
      return { avg, basis: 'trip history' };
    }
  }

  // Fallback: lifetime odometer spread over the vehicle's age.
  if (vehicle.purchase_date && vehicle.current_odometer > 0) {
    const age = Math.max(daysBetween(vehicle.purchase_date, toDateString(new Date())), 1);
    const avg = vehicle.current_odometer / age;
    if (avg >= MIN_AVG_DAILY_KM) {
      return { avg, basis: 'lifetime average' };
    }
  }

  return { avg: MIN_AVG_DAILY_KM, basis: 'minimum assumed usage' };
}

/**
 * Step 2: the service interval to apply, and which maintenance type it is for.
 * Blends the configured interval with the cadence this vehicle actually shows.
 */
function computeInterval(history, serviceTypes) {
  // The maintenance type this vehicle receives most often.
  const typeCounts = new Map();
  history.forEach((h) => {
    typeCounts.set(h.maintenance_type, (typeCounts.get(h.maintenance_type) || 0) + 1);
  });

  let maintenanceType = 'Routine Service';
  let best = 0;
  typeCounts.forEach((count, type) => {
    if (count > best) {
      best = count;
      maintenanceType = type;
    }
  });

  const configured = serviceTypes.get(maintenanceType);
  let intervalKm = configured ? configured.service_interval_km : DEFAULT_INTERVAL_KM;
  let intervalDays = configured ? configured.service_interval_days : DEFAULT_INTERVAL_DAYS;
  let basis = configured ? `${maintenanceType} schedule` : 'default schedule';

  // Observed cadence: average odometer gap between consecutive services.
  const sameType = history.filter((h) => h.maintenance_type === maintenanceType);
  if (sameType.length >= 2) {
    const gaps = [];
    const dayGaps = [];
    for (let i = 1; i < sameType.length; i += 1) {
      const km = sameType[i].odometer_reading - sameType[i - 1].odometer_reading;
      const days = daysBetween(sameType[i - 1].service_date, sameType[i].service_date);
      if (km > 0) gaps.push(km);
      if (days > 0) dayGaps.push(days);
    }
    if (gaps.length) {
      const observedKm = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      // Blend 50/50 so one unusual service does not skew the projection.
      intervalKm = Math.round((intervalKm + observedKm) / 2);
      basis = `${maintenanceType} schedule blended with this vehicle's history`;
    }
    if (dayGaps.length) {
      const observedDays = dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length;
      intervalDays = Math.round((intervalDays + observedDays) / 2);
    }
  }

  return { maintenanceType, intervalKm, intervalDays, basis };
}

/**
 * Produce a forecast object for one vehicle. Exported so it can be unit-tested
 * and reused by the per-vehicle endpoint without touching the database.
 */
function buildForecast(vehicle, data, serviceTypes) {
  const today = new Date();
  const todayISO = toDateString(today);

  const { avg: avgDailyKm, basis: usageBasis } = computeAvgDailyKm(vehicle, data.usage);
  const { maintenanceType, intervalKm, intervalDays, basis: intervalBasis } =
    computeInterval(data.history, serviceTypes);

  const lastService = data.history.length ? data.history[data.history.length - 1] : null;
  const lastServiceOdo = lastService
    ? lastService.odometer_reading
    : Math.max(vehicle.current_odometer - intervalKm, 0);
  const lastServiceDate = lastService ? lastService.service_date : vehicle.last_service_date;

  // Step 3: predicted service odometer.
  const predictedOdometer = lastServiceOdo + intervalKm;

  // Step 4: kilometre-based countdown.
  const kmRemaining = predictedOdometer - vehicle.current_odometer;
  const daysByKm = kmRemaining / avgDailyKm;

  // Step 5: calendar-based countdown.
  let daysByDate = Infinity;
  if (lastServiceDate) {
    const dueDate = addDays(new Date(`${lastServiceDate}T00:00:00`), intervalDays);
    daysByDate = daysBetween(todayISO, toDateString(dueDate));
  } else if (vehicle.next_service_date) {
    daysByDate = daysBetween(todayISO, vehicle.next_service_date);
  }

  // Step 6: whichever limit binds first.
  const daysUntilService = Math.round(
    Math.max(Math.min(daysByKm, daysByDate), -MAX_HORIZON_DAYS)
  );
  const cappedDays = Math.min(daysUntilService, MAX_HORIZON_DAYS);
  const predictedDate = addDays(today, cappedDays);

  // Step 7: risk level.
  let riskLevel;
  if (cappedDays < 0) riskLevel = 'CRITICAL';
  else if (cappedDays <= 15) riskLevel = 'HIGH';
  else if (cappedDays <= 30) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  const repairCount = Number(data.repairs.repair_count) || 0;
  const escalated = repairCount >= REPAIR_ESCALATION_THRESHOLD && riskLevel !== 'CRITICAL';
  if (escalated) riskLevel = escalate(riskLevel);

  // Vehicles already off the road are a live problem regardless of the maths.
  if (vehicle.status === 'Out of Service') riskLevel = 'CRITICAL';

  // Human-readable justification stored alongside the numbers.
  const driver = daysByKm <= daysByDate ? 'distance' : 'elapsed time';
  const reasonParts = [
    `Averaging ${avgDailyKm.toFixed(1)} km/day (${usageBasis}).`,
    `Interval ${intervalKm.toLocaleString()} km / ${intervalDays} days from ${intervalBasis}.`,
    `Last service at ${lastServiceOdo.toLocaleString()} km${lastServiceDate ? ` on ${lastServiceDate}` : ''}.`,
    cappedDays < 0
      ? `Service is overdue by ${Math.abs(cappedDays)} days (${driver}-driven).`
      : `Due in ~${cappedDays} days, ${driver}-driven.`,
  ];
  if (escalated) {
    reasonParts.push(`Escalated: ${repairCount} repairs in the last ${REPAIR_WINDOW_DAYS} days.`);
  }
  if (vehicle.status === 'Out of Service') {
    reasonParts.push('Vehicle is currently Out of Service.');
  }

  return {
    vehicle_id: vehicle.vehicle_id,
    vehicle_number: vehicle.vehicle_number,
    predicted_service_date: toDateString(predictedDate),
    predicted_odometer: Math.max(Math.round(predictedOdometer), 0),
    maintenance_type: maintenanceType,
    risk_level: riskLevel,
    reason: reasonParts.join(' ').slice(0, 500),
    avg_daily_km: Number(avgDailyKm.toFixed(2)),
    days_until_service: cappedDays,
    // Extra detail returned to the API but not persisted as columns:
    km_remaining: Math.round(kmRemaining),
    service_interval_km: intervalKm,
    service_interval_days: intervalDays,
    last_service_odometer: lastServiceOdo,
    last_service_date: lastServiceDate,
    recent_repair_count: repairCount,
  };
}

/**
 * Regenerate forecasts for the whole fleet (or one vehicle) and persist them.
 * @param {number|null} vehicleId
 */
async function generateForecasts(vehicleId = null) {
  const serviceTypes = await loadServiceTypes();

  const vehicles = vehicleId
    ? await query('SELECT * FROM vehicles WHERE vehicle_id = ?', [vehicleId])
    : await query('SELECT * FROM vehicles ORDER BY vehicle_id');

  if (vehicles.length === 0) return [];

  const forecasts = [];
  for (const vehicle of vehicles) {
    // Sequential on purpose: keeps pool pressure predictable on large fleets.
    // eslint-disable-next-line no-await-in-loop
    const data = await collectVehicleData(vehicle);
    forecasts.push(buildForecast(vehicle, data, serviceTypes));
  }

  await transaction(async (conn) => {
    if (vehicleId) {
      await ForecastModel.clearForVehicle(vehicleId, conn);
    } else {
      await ForecastModel.clearAll(conn);
    }
    for (const f of forecasts) {
      // eslint-disable-next-line no-await-in-loop
      await ForecastModel.create(f, conn);
    }
  });

  return forecasts;
}

/** Compute a forecast for one vehicle without persisting it. */
async function previewForecast(vehicleId) {
  const rows = await query('SELECT * FROM vehicles WHERE vehicle_id = ?', [vehicleId]);
  if (rows.length === 0) return null;
  const serviceTypes = await loadServiceTypes();
  const data = await collectVehicleData(rows[0]);
  return buildForecast(rows[0], data, serviceTypes);
}

module.exports = {
  generateForecasts,
  previewForecast,
  buildForecast,
  computeAvgDailyKm,
  computeInterval,
};
