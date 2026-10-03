const express = require('express');
const ctrl = require('../controllers/forecastController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getForecasts);
router.post(
  '/generate',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  ctrl.generateForecast
);
router.get('/:vehicleId', idParam('vehicleId'), runValidation, ctrl.getForecastByVehicle);

module.exports = router;
