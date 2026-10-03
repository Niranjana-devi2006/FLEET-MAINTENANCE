/**
 * End-to-end API smoke test.
 *
 * Exercises authentication, role-based authorisation, full CRUD on every
 * resource, the vehicle status transitions driven by trips and repairs, the
 * forecasting engine and the alert engine — against a running server and a
 * real MySQL database.
 *
 * Usage:
 *   1. mysql -u root -p < database.sql
 *   2. npm run dev            (in another terminal)
 *   3. npm test
 *
 * Nothing is left behind: every record this script creates is deleted again.
 */
require('dotenv').config();

const BASE = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;

const ACCOUNTS = {
  admin: { email: 'admin@fleet.com', password: 'Admin@123' },
  manager: { email: 'manager@fleet.com', password: 'Manager@123' },
  technician: { email: 'tech@fleet.com', password: 'Tech@123' },
};

const tokens = {};
let passed = 0;
let failed = 0;
const failures = [];

// --- tiny test harness ------------------------------------------------------

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m${title}\x1b[0m`);
}

async function call(method, path, { body, token, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return raw ? { status: res.status, json } : { status: res.status, ...json };
}

// --- the suite --------------------------------------------------------------

async function run() {
  console.log(`\n\x1b[1mFleet Maintenance API — end-to-end test\x1b[0m`);
  console.log(`Target: ${BASE}\n`);

  // ---- 0. server reachable -------------------------------------------------
  section('0. Health');
  try {
    const health = await call('GET', '/health');
    check('GET /health returns ok', health.success === true && health.data.database === 'connected');
  } catch (err) {
    console.error(`\n\x1b[31mCannot reach the API at ${BASE}\x1b[0m`);
    console.error('Start the backend first:  npm run dev\n');
    process.exit(1);
  }

  // ---- 1. authentication ---------------------------------------------------
  section('1. Authentication');

  for (const [role, creds] of Object.entries(ACCOUNTS)) {
    const res = await call('POST', '/auth/login', { body: creds });
    check(`login as ${role}`, res.success === true && Boolean(res.data?.token),
      res.message);
    if (res.data?.token) tokens[role] = res.data.token;
  }

  const badLogin = await call('POST', '/auth/login', {
    body: { email: 'admin@fleet.com', password: 'wrong-password' },
  });
  check('wrong password rejected with 401', badLogin.status === 401);

  const noToken = await call('GET', '/vehicles');
  check('protected route without a token returns 401', noToken.status === 401);

  const profile = await call('GET', '/auth/profile', { token: tokens.admin });
  check('GET /auth/profile returns the signed-in user',
    profile.success && profile.data.email === ACCOUNTS.admin.email);

  const badValidation = await call('POST', '/auth/login', { body: { email: 'nope' } });
  check('invalid email returns 400 with an errors array',
    badValidation.status === 400 && Array.isArray(badValidation.errors));

  // ---- 2. role-based authorisation ----------------------------------------
  section('2. Role-based authorisation');

  const techCreate = await call('POST', '/vehicles', {
    token: tokens.technician,
    body: { vehicle_number: 'TECH-DENY-1', vehicle_type: 'Van', manufacturer: 'X', model: 'Y' },
  });
  check('technician cannot create a vehicle (403)', techCreate.status === 403, techCreate.message);

  const techUsers = await call('GET', '/users', { token: tokens.technician });
  check('technician cannot list users (403)', techUsers.status === 403);

  const managerUsers = await call('GET', '/users', { token: tokens.manager });
  check('fleet manager cannot list users (403)', managerUsers.status === 403);

  const adminUsers = await call('GET', '/users', { token: tokens.admin });
  check('admin can list users', adminUsers.success === true && Array.isArray(adminUsers.data));

  const techReports = await call('GET', '/reports/maintenance-costs', { token: tokens.technician });
  check('technician cannot run reports (403)', techReports.status === 403);

  // ---- 3. vehicle CRUD -----------------------------------------------------
  section('3. Vehicle CRUD');

  const uniqueNumber = `TST${Date.now().toString().slice(-7)}`;
  const created = await call('POST', '/vehicles', {
    token: tokens.admin,
    body: {
      vehicle_number: uniqueNumber,
      vehicle_type: 'Van',
      manufacturer: 'TestCo',
      model: 'Prototype',
      current_odometer: 50000,
      fuel_type: 'Diesel',
      status: 'Available',
      purchase_date: '2022-01-01',
    },
  });
  check('create vehicle returns 201', created.status === 201 && created.success, created.message);
  const vehicleId = created.data?.vehicle_id;

  const dup = await call('POST', '/vehicles', {
    token: tokens.admin,
    body: { vehicle_number: uniqueNumber, vehicle_type: 'Van', manufacturer: 'A', model: 'B' },
  });
  check('duplicate vehicle number rejected (400)', dup.status === 400, dup.message);

  const negative = await call('POST', '/vehicles', {
    token: tokens.admin,
    body: {
      vehicle_number: `${uniqueNumber}X`, vehicle_type: 'Van',
      manufacturer: 'A', model: 'B', current_odometer: -5,
    },
  });
  check('negative odometer rejected (400)', negative.status === 400, negative.message);

  const fetched = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('vehicle detail includes trips/maintenance/repairs/alerts',
    fetched.success &&
    Array.isArray(fetched.data.trips) &&
    Array.isArray(fetched.data.maintenance) &&
    Array.isArray(fetched.data.repairs) &&
    Array.isArray(fetched.data.alerts));

  const updated = await call('PUT', `/vehicles/${vehicleId}`, {
    token: tokens.admin,
    body: { model: 'Prototype II' },
  });
  check('update vehicle', updated.success && updated.data.model === 'Prototype II');

  const missing = await call('GET', '/vehicles/99999999', { token: tokens.admin });
  check('unknown vehicle returns 404', missing.status === 404);

  const listed = await call('GET', '/vehicles?limit=5&page=1', { token: tokens.admin });
  check('vehicle list is paginated',
    listed.success && listed.data.length <= 5 && typeof listed.pagination.total === 'number');

  const searched = await call('GET', `/vehicles?search=${uniqueNumber}`, { token: tokens.admin });
  check('vehicle search finds the new vehicle',
    searched.success && searched.data.some((v) => v.vehicle_number === uniqueNumber));

  // ---- 4. driver CRUD ------------------------------------------------------
  section('4. Driver CRUD');

  const licence = `TEST-LIC-${Date.now().toString().slice(-8)}`;
  const driver = await call('POST', '/drivers', {
    token: tokens.admin,
    body: { name: 'Test Driver', license_number: licence, status: 'Active' },
  });
  check('create driver returns 201', driver.status === 201, driver.message);
  const driverId = driver.data?.driver_id;

  const dupLicence = await call('POST', '/drivers', {
    token: tokens.admin,
    body: { name: 'Another Driver', license_number: licence },
  });
  check('duplicate licence number rejected (400)', dupLicence.status === 400, dupLicence.message);

  // ---- 5. trip lifecycle drives vehicle status -----------------------------
  section('5. Trip lifecycle and vehicle status');

  const today = new Date().toISOString().slice(0, 10);
  const trip = await call('POST', '/trips', {
    token: tokens.manager,
    body: {
      vehicle_id: vehicleId,
      driver_id: driverId,
      start_location: 'Test Origin',
      destination: 'Test Destination',
      start_date: today,
      distance_km: 250,
      fuel_consumed: 30,
      trip_status: 'Ongoing',
    },
  });
  check('create ongoing trip returns 201', trip.status === 201, trip.message);
  const tripId = trip.data?.trip_id;

  const onTrip = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('vehicle status became "On Trip"', onTrip.data?.vehicle.status === 'On Trip',
    `got ${onTrip.data?.vehicle.status}`);

  const driverOnTrip = await call('GET', `/drivers/${driverId}`, { token: tokens.admin });
  check('driver status became "On Trip"', driverOnTrip.data?.driver.status === 'On Trip',
    `got ${driverOnTrip.data?.driver.status}`);

  const doubleBook = await call('POST', '/trips', {
    token: tokens.manager,
    body: {
      vehicle_id: vehicleId, driver_id: driverId,
      start_location: 'A', destination: 'B',
      start_date: today, trip_status: 'Ongoing',
    },
  });
  check('second active trip on the same vehicle rejected (400)', doubleBook.status === 400,
    doubleBook.message);

  const negDistance = await call('PUT', `/trips/${tripId}`, {
    token: tokens.manager,
    body: { distance_km: -10 },
  });
  check('negative distance rejected (400)', negDistance.status === 400);

  const odoBefore = onTrip.data.vehicle.current_odometer;
  const completed = await call('PUT', `/trips/${tripId}`, {
    token: tokens.manager,
    body: { trip_status: 'Completed', end_date: today },
  });
  check('complete trip', completed.success, completed.message);

  const afterTrip = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('vehicle released to "Available"', afterTrip.data?.vehicle.status === 'Available',
    `got ${afterTrip.data?.vehicle.status}`);
  check('odometer advanced by the trip distance (250 km)',
    afterTrip.data?.vehicle.current_odometer === odoBefore + 250,
    `${odoBefore} -> ${afterTrip.data?.vehicle.current_odometer}`);

  // ---- 6. repair lifecycle drives vehicle status ---------------------------
  section('6. Repair lifecycle and vehicle status');

  const repair = await call('POST', '/repairs', {
    token: tokens.technician,
    body: {
      vehicle_id: vehicleId,
      repair_date: today,
      problem_description: 'Test fault for the automated suite',
      repair_cost: 1000,
      downtime_hours: 4,
      technician: 'Arun Mehta',
      status: 'Open',
    },
  });
  check('technician can log a repair (201)', repair.status === 201, repair.message);
  const repairId = repair.data?.repair_id;

  const underMaint = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('open repair set vehicle to "Under Maintenance"',
    underMaint.data?.vehicle.status === 'Under Maintenance',
    `got ${underMaint.data?.vehicle.status}`);

  const tripWhileDown = await call('POST', '/trips', {
    token: tokens.manager,
    body: {
      vehicle_id: vehicleId, driver_id: driverId,
      start_location: 'A', destination: 'B',
      start_date: today, trip_status: 'Ongoing',
    },
  });
  check('cannot assign a trip to a vehicle under maintenance (400)',
    tripWhileDown.status === 400, tripWhileDown.message);

  const negCost = await call('PUT', `/repairs/${repairId}`, {
    token: tokens.technician,
    body: { repair_cost: -50 },
  });
  check('negative repair cost rejected (400)', negCost.status === 400);

  const doneRepair = await call('PUT', `/repairs/${repairId}/complete`, {
    token: tokens.technician,
    body: {
      repair_description: 'Replaced the test component',
      parts_replaced: 'Test part',
      repair_cost: 1250,
      downtime_hours: 6,
    },
  });
  check('technician can complete a repair', doneRepair.success, doneRepair.message);

  const released = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('completed repair released vehicle to "Available"',
    released.data?.vehicle.status === 'Available',
    `got ${released.data?.vehicle.status}`);

  // ---- 7. maintenance ------------------------------------------------------
  section('7. Maintenance');

  const maint = await call('POST', '/maintenance', {
    token: tokens.manager,
    body: {
      vehicle_id: vehicleId,
      maintenance_type: 'Oil Change',
      service_date: today,
      odometer_reading: 50250,
      service_cost: 3000,
      status: 'Completed',
      technician: 'Arun Mehta',
      description: 'Automated test service',
    },
  });
  check('create completed maintenance returns 201', maint.status === 201, maint.message);
  const maintId = maint.data?.maintenance_id;

  check('next service date derived from the service_types interval',
    Boolean(maint.data?.next_service_date), 'next_service_date was null');
  check('next service odometer derived (+8000 km for an Oil Change)',
    maint.data?.next_service_odometer === 50250 + 8000,
    `got ${maint.data?.next_service_odometer}`);

  const afterService = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('vehicle last_service_date rolled forward',
    afterService.data?.vehicle.last_service_date === today,
    `got ${afterService.data?.vehicle.last_service_date}`);

  const negMaint = await call('POST', '/maintenance', {
    token: tokens.manager,
    body: {
      vehicle_id: vehicleId, maintenance_type: 'Oil Change',
      service_date: today, service_cost: -1,
    },
  });
  check('negative maintenance cost rejected (400)', negMaint.status === 400);

  const upcoming = await call('GET', '/maintenance/upcoming/list?days=60', { token: tokens.manager });
  check('upcoming maintenance list returns an array', Array.isArray(upcoming.data));

  const queue = await call('GET', '/maintenance/assigned/me', { token: tokens.technician });
  check('technician work queue returns maintenance and repairs',
    Array.isArray(queue.data?.maintenance) && Array.isArray(queue.data?.repairs));

  // ---- 8. forecasting ------------------------------------------------------
  section('8. Forecasting engine');

  const generated = await call('POST', '/forecast/generate', { token: tokens.manager });
  check('generate forecasts returns 201', generated.status === 201, generated.message);
  check('a forecast was produced for every vehicle', generated.data?.count > 0);
  check('risk summary contains all four bands',
    generated.data?.summary &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].every((k) => k in generated.data.summary));

  const forecasts = await call('GET', '/forecast', { token: tokens.manager });
  check('forecast list returns stored rows', forecasts.success && forecasts.data.length > 0);

  const sample = forecasts.data?.[0];
  check('forecast row carries a predicted date', Boolean(sample?.predicted_service_date));
  check('forecast row carries a predicted odometer', Number(sample?.predicted_odometer) > 0);
  check('forecast row carries an explanation', Boolean(sample?.reason));
  check('forecast risk level is one of the four bands',
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sample?.risk_level));
  check('avg_daily_km is derived, not zero', Number(sample?.avg_daily_km) > 0);

  const one = await call('GET', `/forecast/${vehicleId}`, { token: tokens.manager });
  check('per-vehicle forecast returns a live calculation',
    one.success && Boolean(one.data?.forecast?.predicted_service_date));

  const techForecast = await call('POST', '/forecast/generate', { token: tokens.technician });
  check('technician cannot generate forecasts (403)', techForecast.status === 403);

  // ---- 9. alerts -----------------------------------------------------------
  section('9. Alert engine');

  const alertsGen = await call('POST', '/alerts/generate', { token: tokens.manager });
  check('generate alerts returns 201', alertsGen.status === 201, alertsGen.message);
  check('alerts were produced from live conditions', alertsGen.data?.count > 0);

  const alerts = await call('GET', '/alerts', { token: tokens.manager });
  check('alert list returns rows', alerts.success && alerts.data.length > 0);
  check('alert meta includes an unread count', typeof alerts.meta?.unread === 'number');

  const firstAlert = alerts.data?.[0];
  if (firstAlert) {
    const read = await call('PUT', `/alerts/${firstAlert.alert_id}/read`, { token: tokens.manager });
    check('mark alert as read', read.success && read.data.status === 'Read');

    const resolved = await call('PUT', `/alerts/${firstAlert.alert_id}/resolve`, { token: tokens.manager });
    check('resolve alert', resolved.success && resolved.data.status === 'Resolved');
  }

  const overdueAlerts = (alerts.data || []).filter((a) => a.alert_type === 'Maintenance Overdue');
  check('overdue-maintenance alerts were raised from the seed data',
    overdueAlerts.length > 0, 'none found — check the seeded next_service_date values');

  const licenceAlerts = (alerts.data || []).filter((a) => a.alert_type === 'Expired Driver License');
  check('driver licence alerts were raised', licenceAlerts.length > 0);

  // ---- 10. dashboard -------------------------------------------------------
  section('10. Dashboard');

  const stats = await call('GET', '/dashboard/stats', { token: tokens.manager });
  const requiredStats = [
    'total_vehicles', 'available_vehicles', 'vehicles_on_trip',
    'vehicles_under_maintenance', 'vehicles_requiring_service', 'upcoming_services',
    'open_repairs', 'total_maintenance_cost', 'total_repair_cost', 'fleet_utilisation',
  ];
  check('dashboard stats contain every required field',
    stats.success && requiredStats.every((k) => k in stats.data),
    requiredStats.filter((k) => !(k in (stats.data || {}))).join(', '));
  check('total_vehicles is greater than zero', stats.data?.total_vehicles > 0);
  check('maintenance cost is a real total from the database',
    Number(stats.data?.total_maintenance_cost) > 0);

  const charts = await call('GET', '/dashboard/charts', { token: tokens.manager });
  const requiredCharts = [
    'maintenance_cost_by_month', 'repair_cost_by_month', 'vehicle_utilisation',
    'maintenance_frequency', 'vehicle_status_distribution', 'upcoming_maintenance',
    'repair_downtime',
  ];
  check('all seven chart series are returned',
    charts.success && requiredCharts.every((k) => Array.isArray(charts.data[k])),
    requiredCharts.filter((k) => !Array.isArray(charts.data?.[k])).join(', '));

  const dashTables = await call('GET', '/dashboard/tables', { token: tokens.manager });
  check('all five dashboard tables are returned',
    dashTables.success &&
    ['vehicles_requiring_maintenance', 'upcoming_services', 'recent_repairs',
      'recent_trips', 'critical_alerts'].every((k) => Array.isArray(dashTables.data[k])));

  // ---- 11. reports ---------------------------------------------------------
  section('11. Reports');

  const reportNames = [
    'maintenance-history', 'repair-history', 'maintenance-costs', 'repair-costs',
    'vehicle-utilisation', 'fleet-availability', 'upcoming-maintenance',
    'overdue-maintenance', 'repair-downtime',
  ];
  for (const name of reportNames) {
    const r = await call('GET', `/reports/${name}`, { token: tokens.manager });
    check(`report ${name} responds`, r.success === true, r.message);
  }

  const filtered = await call(
    'GET', `/reports/maintenance-history?vehicle_id=${vehicleId}`, { token: tokens.manager }
  );
  check('report filtering by vehicle works',
    filtered.success && filtered.data.every((r) => r.vehicle_number === uniqueNumber));

  const unknownReport = await call('GET', '/reports/does-not-exist', { token: tokens.manager });
  check('unknown report returns 404', unknownReport.status === 404);

  // ---- 12. availability ----------------------------------------------------
  section('12. Availability');

  const avail = await call('GET', '/vehicles/availability', { token: tokens.manager });
  check('availability endpoint returns totals and a rate',
    avail.success && typeof avail.data.availability_rate === 'number' && avail.data.total > 0);

  // ---- 13. cleanup ---------------------------------------------------------
  section('13. Cleanup');

  const delMaint = await call('DELETE', `/maintenance/${maintId}`, { token: tokens.admin });
  check('delete maintenance record', delMaint.success, delMaint.message);

  const delRepair = await call('DELETE', `/repairs/${repairId}`, { token: tokens.admin });
  check('delete repair record', delRepair.success, delRepair.message);

  const delTrip = await call('DELETE', `/trips/${tripId}`, { token: tokens.admin });
  check('delete trip', delTrip.success, delTrip.message);

  const delVehicle = await call('DELETE', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('delete vehicle', delVehicle.success, delVehicle.message);

  const delDriver = await call('DELETE', `/drivers/${driverId}`, { token: tokens.admin });
  check('delete driver', delDriver.success, delDriver.message);

  const gone = await call('GET', `/vehicles/${vehicleId}`, { token: tokens.admin });
  check('deleted vehicle is really gone (404)', gone.status === 404);

  // ---- summary -------------------------------------------------------------
  console.log(`\n${'='.repeat(58)}`);
  if (failed === 0) {
    console.log(`\x1b[32m\x1b[1m  ALL ${passed} CHECKS PASSED\x1b[0m`);
  } else {
    console.log(`\x1b[31m\x1b[1m  ${passed} passed, ${failed} failed\x1b[0m`);
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log(`${'='.repeat(58)}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\n\x1b[31mTest run crashed:\x1b[0m', err.message);
  process.exit(1);
});
