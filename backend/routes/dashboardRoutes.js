const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/stats', ctrl.getStats);
router.get('/charts', ctrl.getCharts);
router.get('/tables', ctrl.getTables);
router.get('/', ctrl.getOverview);

module.exports = router;
