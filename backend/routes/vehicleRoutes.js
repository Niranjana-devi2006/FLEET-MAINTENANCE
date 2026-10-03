const express = require('express');
const ctrl = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, vehicleRules, listRules, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// Static paths must be declared before '/:id' so they are not swallowed by it.
router.get('/meta/options', ctrl.getVehicleOptions);
router.get('/availability', ctrl.getAvailability);

router.get('/', listRules, runValidation, ctrl.getVehicles);
router.get('/:id', idParam(), runValidation, ctrl.getVehicleById);
router.get('/:id/forecast', idParam(), runValidation, ctrl.getVehicleForecast);

router.post(
  '/',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  vehicleRules(false), runValidation, ctrl.createVehicle
);
router.put(
  '/:id',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  idParam(), vehicleRules(true), runValidation, ctrl.updateVehicle
);
router.delete('/:id', authorise(ROLES.ADMIN), idParam(), runValidation, ctrl.deleteVehicle);

module.exports = router;
