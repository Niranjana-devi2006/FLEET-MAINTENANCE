const express = require('express');
const ctrl = require('../controllers/maintenanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, maintenanceRules, listRules, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/upcoming/list', ctrl.getUpcoming);
router.get('/assigned/me', ctrl.getAssignedToMe);
router.get('/meta/service-types', ctrl.getServiceTypes);

router.get('/', listRules, runValidation, ctrl.getMaintenance);
router.get('/:id', idParam(), runValidation, ctrl.getMaintenanceById);

router.post(
  '/',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  maintenanceRules(false), runValidation, ctrl.createMaintenance
);
// Technicians may update records to record progress and completion.
router.put(
  '/:id',
  authorise(ROLES.ADMIN, ROLES.MANAGER, ROLES.TECHNICIAN),
  idParam(), maintenanceRules(true), runValidation, ctrl.updateMaintenance
);
router.delete('/:id', authorise(ROLES.ADMIN), idParam(), runValidation, ctrl.deleteMaintenance);

module.exports = router;
