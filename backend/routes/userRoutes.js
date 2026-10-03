const express = require('express');
const ctrl = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorise, ROLES } = require('../middleware/roleMiddleware');
const {
  idParam, registerRules, userUpdateRules, runValidation,
} = require('../utils/validation');

const router = express.Router();

// User management is Admin-only across the board.
router.use(protect, authorise(ROLES.ADMIN));

router.get('/', ctrl.getUsers);
router.get('/:id', idParam(), runValidation, ctrl.getUserById);
router.post('/', registerRules, runValidation, ctrl.createUser);
router.put('/:id', idParam(), userUpdateRules, runValidation, ctrl.updateUser);
router.delete('/:id', idParam(), runValidation, ctrl.deleteUser);

module.exports = router;
