const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { users } = require('../db/schema');

const publicUser = (u) => {
  const { password, ...rest } = u;
  return rest;
};

const getUsers = asyncHandler(async (req, res) => {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  res.json(rows.map(publicUser));
});

const getUser = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users._id, req.params.id));
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(publicUser(user));
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const exists = await db.select({ _id: users._id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (exists.length) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role,
      phone,
    })
    .returning();
  res.status(201).json(publicUser(user));
});

const updateUser = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users._id, req.params.id));
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  const { name, email, role, phone, active, password, avatarColor } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = String(email).toLowerCase();
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone;
  if (active !== undefined) updates.active = active;
  if (avatarColor !== undefined) updates.avatarColor = avatarColor;
  if (password) updates.password = await bcrypt.hash(password, 10);
  updates.updatedAt = new Date();

  const [updated] = await db.update(users).set(updates).where(eq(users._id, req.params.id)).returning();
  res.json(publicUser(updated));
});

const deleteUser = asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users._id, req.params.id));
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user._id === req.user._id) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }
  await db.delete(users).where(eq(users._id, req.params.id));
  res.json({ message: 'User removed' });
});

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
