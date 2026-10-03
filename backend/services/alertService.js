/**
 * Alert generation service.
 *
 * Alerts are derived from live fleet conditions, not stored by hand. Calling
 * `generateAlerts()` clears previously generated (non-resolved) alerts and
 * rebuilds the set from the current state of the database.
 *
 * Conditions covered:
 *   - Maintenance due            (service due within 30 days)
 *   - Maintenance overdue        (next_service_date already passed)
 *   - Upcoming service           (scheduled maintenance record ahead)
 *   - High mileage               (odometer past the high-usage threshold)
 *   - Vehicle under repair       (an open repair exists)
 *   - Long repair downtime       (open repair past the downtime threshold)
 *   - Expired driver license     (expired or expiring soon)
 *   - Vehicle unavailable        (Out of Service)
 */
const { query, transaction } = require('../config/db');
const AlertModel = require('../models/alertModel');

const DUE_SOON_DAYS = 30;
const URGENT_DAYS = 15;
const HIGH_MILEAGE_KM = 200000;
const LONG_DOWNTIME_HOURS = 48;
const LICENSE_WARNING_DAYS = 30;

const TYPES = {
  MAINTENANCE_DUE: 'Maintenance Due',
  MAINTENANCE_OVERDUE: 'Maintenance Overdue',
  UPCOMING_SERVICE: 'Upcoming Service',
  HIGH_MILEAGE: 'High Mileage',
  UNDER_REPAIR: 'Vehicle Under Repair',
  LONG_DOWNTIME: 'Long Repair Downtime',
  LICENSE_EXPIRED: 'Expired Driver License',
  VEHICLE_UNAVAILABLE: 'Vehicle Unavailable',
};

/** Build the full list of alerts the current fleet state warrants. */
async function evaluateConditions() {
  const alerts = [];

  // --- vehicles: service due / overdue / mileage / availability ------------
  const vehicles = await query(
    `SELECT vehicle_id, vehicle_number, current_odometer, status,
            last_service_date, next_service_date,
            DATEDIFF(next_service_date, CURDATE()) AS days_remaining
     FROM vehicles`
  );

  vehicles.forEach((v) => {
    const days = v.days_remaining;

    if (v.next_service_date !== null && days !== null) {
      if (days < 0) {
        alerts.push({
          vehicle_id: v.vehicle_id,
          alert_type: TYPES.MAINTENANCE_OVERDUE,
          alert_message: `${v.vehicle_number}: maintenance is overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`,
          priority: 'Critical',
        });
      } else if (days <= URGENT_DAYS) {
        alerts.push({
          vehicle_id: v.vehicle_id,
          alert_type: TYPES.MAINTENANCE_DUE,
          alert_message: `${v.vehicle_number}: maintenance due in ${days} day${days === 1 ? '' : 's'}`,
          priority: 'High',
        });
      } else if (days <= DUE_SOON_DAYS) {
        alerts.push({
          vehicle_id: v.vehicle_id,
          alert_type: TYPES.MAINTENANCE_DUE,
          alert_message: `${v.vehicle_number}: maintenance due in ${days} days`,
          priority: 'Medium',
        });
      }
    }

    if (v.current_odometer >= HIGH_MILEAGE_KM) {
      alerts.push({
        vehicle_id: v.vehicle_id,
        alert_type: TYPES.HIGH_MILEAGE,
        alert_message: `${v.vehicle_number} has covered ${v.current_odometer.toLocaleString()} km - schedule a major inspection`,
        priority: 'Medium',
      });
    }

    if (v.status === 'Out of Service') {
      alerts.push({
        vehicle_id: v.vehicle_id,
        alert_type: TYPES.VEHICLE_UNAVAILABLE,
        alert_message: `${v.vehicle_number} is Out of Service and unavailable for assignment`,
        priority: 'Critical',
      });
    }
  });

  // --- scheduled maintenance ahead ----------------------------------------
  const upcoming = await query(
    `SELECT m.maintenance_id, m.maintenance_type, m.service_date, m.vehicle_id,
            v.vehicle_number, DATEDIFF(m.service_date, CURDATE()) AS days_remaining
     FROM maintenance m
     JOIN vehicles v ON v.vehicle_id = m.vehicle_id
     WHERE m.status = 'Scheduled'
       AND m.service_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [DUE_SOON_DAYS]
  );

  upcoming.forEach((m) => {
    alerts.push({
      vehicle_id: m.vehicle_id,
      alert_type: TYPES.UPCOMING_SERVICE,
      alert_message: `${m.vehicle_number}: ${m.maintenance_type} scheduled in ${m.days_remaining} day${m.days_remaining === 1 ? '' : 's'} (${m.service_date})`,
      priority: m.days_remaining <= 7 ? 'Medium' : 'Low',
    });
  });

  // --- open repairs --------------------------------------------------------
  const repairs = await query(
    `SELECT r.repair_id, r.vehicle_id, r.downtime_hours, r.problem_description,
            r.status, v.vehicle_number
     FROM repairs r
     JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     WHERE r.status IN ('Open','In Progress')`
  );

  repairs.forEach((r) => {
    if (Number(r.downtime_hours) >= LONG_DOWNTIME_HOURS) {
      alerts.push({
        vehicle_id: r.vehicle_id,
        alert_type: TYPES.LONG_DOWNTIME,
        alert_message: `${r.vehicle_number} has been down ${Number(r.downtime_hours).toFixed(0)} hours on an open repair`,
        priority: 'High',
      });
    } else {
      alerts.push({
        vehicle_id: r.vehicle_id,
        alert_type: TYPES.UNDER_REPAIR,
        alert_message: `${r.vehicle_number} is under repair: ${String(r.problem_description).slice(0, 120)}`,
        priority: 'Medium',
      });
    }
  });

  // --- driver licences -----------------------------------------------------
  const drivers = await query(
    `SELECT driver_id, name, license_number, license_expiry,
            DATEDIFF(license_expiry, CURDATE()) AS days_remaining
     FROM drivers
     WHERE license_expiry IS NOT NULL
       AND license_expiry <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [LICENSE_WARNING_DAYS]
  );

  drivers.forEach((d) => {
    const expired = d.days_remaining < 0;
    alerts.push({
      vehicle_id: null,
      alert_type: TYPES.LICENSE_EXPIRED,
      alert_message: expired
        ? `Driver ${d.name}: license ${d.license_number} expired ${Math.abs(d.days_remaining)} day${Math.abs(d.days_remaining) === 1 ? '' : 's'} ago`
        : `Driver ${d.name}: license ${d.license_number} expires in ${d.days_remaining} day${d.days_remaining === 1 ? '' : 's'}`,
      priority: expired ? 'Critical' : 'High',
    });
  });

  return alerts;
}

/**
 * Rebuild the alert table from live conditions.
 * Alerts an operator marked Resolved are left untouched.
 */
async function generateAlerts() {
  const alerts = await evaluateConditions();

  await transaction(async (conn) => {
    await AlertModel.clearGenerated(conn);
    for (const a of alerts) {
      // eslint-disable-next-line no-await-in-loop
      await AlertModel.create(a, conn);
    }
  });

  return alerts;
}

/**
 * Raise a single alert immediately, skipping it if an equivalent unresolved
 * alert already exists. Used by the repair/trip flows.
 */
async function raiseAlert({ vehicle_id, alert_type, alert_message, priority = 'Medium' }) {
  const exists = await AlertModel.exists(vehicle_id, alert_type);
  if (exists) return null;
  return AlertModel.create({ vehicle_id, alert_type, alert_message, priority });
}

module.exports = {
  generateAlerts,
  evaluateConditions,
  raiseAlert,
  TYPES,
  thresholds: {
    DUE_SOON_DAYS,
    URGENT_DAYS,
    HIGH_MILEAGE_KM,
    LONG_DOWNTIME_HOURS,
    LICENSE_WARNING_DAYS,
  },
};
