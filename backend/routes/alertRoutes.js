const express = require('express');
const ctrl = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const { idParam, runValidation } = require('../utils/validation');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getAlerts);
router.put('/read-all', ctrl.markAllRead);
router.post('/generate', authorise(ROLES.ADMIN, ROLES.MANAGER), ctrl.generateAlerts);

router.get('/:id', idParam(), runValidation, ctrl.getAlertById);
router.put('/:id/read', idParam(), runValidation, ctrl.markAlertRead);
router.put('/:id/resolve', idParam(), runValidation, ctrl.resolveAlert);
router.delete('/:id', authorise(ROLES.ADMIN, ROLES.MANAGER), idParam(), runValidation, ctrl.deleteAlert);

module.exports = router;
