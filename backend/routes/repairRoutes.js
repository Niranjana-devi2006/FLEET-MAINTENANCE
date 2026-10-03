const express = require('express');
const ctrl = require('../controllers/repairController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, repairRules, listRules, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/open/list', ctrl.getOpenRepairs);
router.get('/', listRules, runValidation, ctrl.getRepairs);
router.get('/:id', idParam(), runValidation, ctrl.getRepairById);

router.post(
  '/',
  authorise(ROLES.ADMIN, ROLES.MANAGER, ROLES.TECHNICIAN),
  repairRules(false), runValidation, ctrl.createRepair
);
router.put(
  '/:id',
  authorise(ROLES.ADMIN, ROLES.MANAGER, ROLES.TECHNICIAN),
  idParam(), repairRules(true), runValidation, ctrl.updateRepair
);
router.put(
  '/:id/complete',
  authorise(ROLES.ADMIN, ROLES.MANAGER, ROLES.TECHNICIAN),
  idParam(), runValidation, ctrl.completeRepair
);
router.delete('/:id', authorise(ROLES.ADMIN), idParam(), runValidation, ctrl.deleteRepair);

module.exports = router;
