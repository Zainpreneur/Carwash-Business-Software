const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { eq, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const { users } = require('../db/schema');
const generateToken = require('../utils/generateToken');

const hashPassword = (plain) => bcrypt.hash(plain, 10);

// @desc    Register a new user (admin/manager only in practice, first user open)
// @route   POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await db.select({ _id: users._id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  // First registered user becomes admin automatically; afterwards default to staff
  const [{ count }] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(users);
  const assignedRole = count === 0 ? 'admin' : role || 'staff';

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase(),
      password: await hashPassword(password),
      role: assignedRole,
      phone,
    })
    .returning();

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id),
  });
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.active) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    token: generateToken(user._id),
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

module.exports = { register, login, getMe };
