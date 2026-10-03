const express = require('express');
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registerRules, loginRules, runValidation } = require('../utils/validation');

const router = express.Router();

router.post('/register', registerRules, runValidation, ctrl.register);
router.post('/login', loginRules, runValidation, ctrl.login);
router.get('/profile', protect, ctrl.getProfile);
router.put('/profile', protect, ctrl.updateProfile);
router.put('/password', protect, ctrl.changePassword);

module.exports = router;
