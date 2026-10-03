const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const { signToken } = require('../middleware/authMiddleware');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Public. Self-registration is limited to Fleet Manager / Technician - an
 * Admin account can only be created by an existing Admin via /api/users.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  let { role } = req.body;

  if (role === 'Admin') {
    throw new ApiError(403, 'Admin accounts can only be created by an existing administrator');
  }
  if (!role) role = 'Fleet Manager';

  const existing = await UserModel.findByEmailWithPassword(email);
  if (existing) {
    throw new ApiError(400, 'An account with this email address already exists');
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({
    name,
    email,
    password: hashed,
    role,
    phone: phone || null,
  });

  const token = signToken(user);
  res.status(201).json({ success: true, data: { user, token } });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.findByEmailWithPassword(email);
  // Same message either way so the endpoint does not confirm which emails exist.
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new ApiError(401, 'Invalid email or password');

  delete user.password;
  const token = signToken(user);

  res.status(200).json({ success: true, data: { user, token } });
});

/**
 * GET /api/auth/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.user_id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json({ success: true, data: user });
});

/**
 * PUT /api/auth/profile
 * Updates the signed-in user's own name / phone / email.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, email } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (phone !== undefined) fields.phone = phone || null;
  if (email !== undefined) fields.email = email;

  const user = await UserModel.update(req.user.user_id, fields);
  res.status(200).json({ success: true, data: user });
});

/**
 * PUT /api/auth/password
 * Requires the current password.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Both the current and new password are required');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const hash = await UserModel.findPasswordById(req.user.user_id);
  if (!hash) throw new ApiError(404, 'User not found');

  const match = await bcrypt.compare(currentPassword, hash);
  if (!match) throw new ApiError(401, 'Current password is incorrect');

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.update(req.user.user_id, { password: hashed });

  res.status(200).json({ success: true, data: { message: 'Password updated successfully' } });
});

module.exports = { register, login, getProfile, updateProfile, changePassword };
