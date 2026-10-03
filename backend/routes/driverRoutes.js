const express = require('express');
const ctrl = require('../controllers/driverController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, driverRules, listRules, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/expiring/licenses', ctrl.getExpiringLicenses);
router.get('/', listRules, runValidation, ctrl.getDrivers);
router.get('/:id', idParam(), runValidation, ctrl.getDriverById);

router.post(
  '/',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  driverRules(false), runValidation, ctrl.createDriver
);
router.put(
  '/:id',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  idParam(), driverRules(true), runValidation, ctrl.updateDriver
);
router.delete('/:id', authorise(ROLES.ADMIN), idParam(), runValidation, ctrl.deleteDriver);

module.exports = router;
