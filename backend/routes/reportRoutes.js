const express = require('express');
const ctrl = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { listRules, runValidation } = require('../utils/validation');

const router = express.Router();

// Reporting is for Admin and Fleet Manager; technicians work from their queue.
router.use(protect, authorise(ROLES.ADMIN, ROLES.MANAGER));

router.get('/maintenance-history', listRules, runValidation, ctrl.maintenanceHistory);
router.get('/repair-history', listRules, runValidation, ctrl.repairHistory);
router.get('/maintenance-costs', listRules, runValidation, ctrl.maintenanceCosts);
router.get('/repair-costs', listRules, runValidation, ctrl.repairCosts);
router.get('/vehicle-utilisation', ctrl.vehicleUtilisation);
router.get('/fleet-availability', ctrl.fleetAvailability);
router.get('/upcoming-maintenance', ctrl.upcomingMaintenance);
router.get('/overdue-maintenance', ctrl.overdueMaintenance);
router.get('/repair-downtime', listRules, runValidation, ctrl.repairDowntime);

// Generic dispatcher: /api/reports/<report-name>
router.get('/:name', listRules, runValidation, ctrl.runReport);

module.exports = router;
