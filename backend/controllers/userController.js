const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const { ApiError, asyncHandler } = require('../middleware/errorMiddleware');

const SALT_ROUNDS = 10;

/** GET /api/users - Admin only. */
const getUsers = asyncHandler(async (req, res) => {
  const users = await UserModel.findAll();
  res.status(200).json({ success: true, data: users });
});

/** GET /api/users/:id */
const getUserById = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json({ success: true, data: user });
});

/** POST /api/users - Admin creates any account, including other Admins. */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!password) throw new ApiError(400, 'Password is required');

  const existing = await UserModel.findByEmailWithPassword(email);
  if (existing) throw new ApiError(400, 'An account with this email address already exists');

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({
    name,
    email,
    password: hashed,
    role: role || 'Fleet Manager',
    phone: phone || null,
  });

  res.status(201).json({ success: true, data: user });
});

/** PUT /api/users/:id */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await UserModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  const fields = {};
  if (req.body.name !== undefined) fields.name = req.body.name;
  if (req.body.email !== undefined) fields.email = req.body.email;
  if (req.body.phone !== undefined) fields.phone = req.body.phone || null;

  if (req.body.role !== undefined && req.body.role !== user.role) {
    // Never let the last Admin demote themselves out of the system.
    if (user.role === 'Admin') {
      const adminCount = await UserModel.countByRole('Admin');
      if (adminCount <= 1) {
        throw new ApiError(400, 'Cannot change the role of the only remaining administrator');
      }
    }
    fields.role = req.body.role;
  }

  if (req.body.password) {
    fields.password = await bcrypt.hash(req.body.password, SALT_ROUNDS);
  }

  const updated = await UserModel.update(id, fields);
  res.status(200).json({ success: true, data: updated });
});

/** DELETE /api/users/:id */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await UserModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');

  if (Number(id) === Number(req.user.user_id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  if (user.role === 'Admin') {
    const adminCount = await UserModel.countByRole('Admin');
    if (adminCount <= 1) {
      throw new ApiError(400, 'Cannot delete the only remaining administrator');
    }
  }

  await UserModel.remove(id);
  res.status(200).json({
    success: true,
    data: { message: `User ${user.name} deleted successfully` },
  });
});

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
