const express = require('express');
const ctrl = require('../controllers/tripController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, tripRules, listRules, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/', listRules, runValidation, ctrl.getTrips);
router.get('/:id', idParam(), runValidation, ctrl.getTripById);

router.post(
  '/',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  tripRules(false), runValidation, ctrl.createTrip
);
router.put(
  '/:id',
  authorise(ROLES.ADMIN, ROLES.MANAGER),
  idParam(), tripRules(true), runValidation, ctrl.updateTrip
);
router.delete('/:id', authorise(ROLES.ADMIN, ROLES.MANAGER), idParam(), runValidation, ctrl.deleteTrip);

module.exports = router;
