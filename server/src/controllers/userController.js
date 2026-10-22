const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { and, desc, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, tenantMembers } = require('../db/schema');
const { logAudit } = require('../utils/audit');

const ROLES = ['owner', 'admin', 'manager', 'staff'];

/**
 * Staff accounts.
 *
 * A login is a platform-level identity, but who may do what inside a business
 * is the *membership*. These endpoints therefore list and manage the members
 * of the business the caller is working in — never every account on the
 * server.
 */

const memberFields = {
  _id: users._id,
  membershipId: tenantMembers._id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  avatarColor: users.avatarColor,
  active: users.active,
  role: tenantMembers.role,
  status: tenantMembers.status,
  location: tenantMembers.location,
  scopeAllLocations: tenantMembers.scopeAllLocations,
  createdAt: tenantMembers.createdAt,
};

const getUsers = asyncHandler(async (req, res) => {
  const rows = await db
    .select(memberFields)
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.user, users._id))
    .where(eq(tenantMembers.tenant, req.tenantId))
    .orderBy(desc(tenantMembers.createdAt));

  res.json(rows);
});

const getUser = asyncHandler(async (req, res) => {
  const [row] = await db
    .select(memberFields)
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.user, users._id))
    .where(and(eq(tenantMembers.tenant, req.tenantId), eq(users._id, req.params.id)));

  if (!row) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json(row);
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, location, scopeAllLocations } = req.body;

  const lowered = String(email || '').toLowerCase().trim();
  if (!name || !lowered || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }

  const exists = await db.select({ _id: users._id }).from(users).where(eq(users.email, lowered));
  if (exists.length) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: lowered,
      password: await bcrypt.hash(password, 10),
      phone: phone || null,
      platformRole: 'user',
    })
    .returning();

  const [membership] = await db
    .insert(tenantMembers)
    .values({
      tenant: req.tenantId,
      user: user._id,
      role: ROLES.includes(role) ? role : 'staff',
      status: 'active',
      location: location || null,
      scopeAllLocations: scopeAllLocations === undefined ? true : Boolean(scopeAllLocations),
    })
    .returning();

  await logAudit(req, 'member.created', 'tenant_member', membership._id, { email: lowered });

  res.status(201).json({
    _id: user._id,
    membershipId: membership._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarColor: user.avatarColor,
    active: user.active,
    role: membership.role,
    status: membership.status,
    location: membership.location,
    scopeAllLocations: membership.scopeAllLocations,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, phone, active, password, avatarColor, status, location, scopeAllLocations } =
    req.body;

  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, req.tenantId), eq(tenantMembers.user, req.params.id)));

  if (!membership) {
    res.status(404);
    throw new Error('User not found');
  }

  // Everyone may edit their own profile; editing somebody else's needs admin.
  const isSelf = req.params.id === req.user._id;
  const isAdmin = req.membership && ['owner', 'admin'].includes(req.membership.role);
  if (!isSelf && !isAdmin) {
    res.status(403);
    throw new Error('You can only edit your own profile');
  }

  const userUpdates = {};
  if (name !== undefined) userUpdates.name = name;
  if (email !== undefined) userUpdates.email = String(email).toLowerCase();
  if (phone !== undefined) userUpdates.phone = phone;
  if (avatarColor !== undefined) userUpdates.avatarColor = avatarColor;
  if (password) userUpdates.password = await bcrypt.hash(password, 10);
  // Account state is an admin's decision, never the member's own.
  if (active !== undefined && isAdmin) userUpdates.active = Boolean(active);
  if (Object.keys(userUpdates).length) {
    userUpdates.updatedAt = new Date();
    await db.update(users).set(userUpdates).where(eq(users._id, req.params.id));
  }

  const membershipUpdates = {};
  if (isAdmin) {
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        res.status(400);
        throw new Error('Unknown role');
      }
      membershipUpdates.role = role;
    }
    if (status !== undefined) membershipUpdates.status = status;
    if (location !== undefined) membershipUpdates.location = location || null;
    if (scopeAllLocations !== undefined) membershipUpdates.scopeAllLocations = Boolean(scopeAllLocations);
  }

  if (Object.keys(membershipUpdates).length) {
    membershipUpdates.updatedAt = new Date();
    await db
      .update(tenantMembers)
      .set(membershipUpdates)
      .where(eq(tenantMembers._id, membership._id));
  }

  await logAudit(req, 'member.updated', 'tenant_member', membership._id, {
    membership: membershipUpdates,
    user: Object.keys(userUpdates).filter((k) => k !== 'updatedAt' && k !== 'password'),
  });

  const [row] = await db
    .select(memberFields)
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.user, users._id))
    .where(and(eq(tenantMembers.tenant, req.tenantId), eq(users._id, req.params.id)));

  res.json(row);
});

const deleteUser = asyncHandler(async (req, res) => {
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, req.tenantId), eq(tenantMembers.user, req.params.id)));

  if (!membership) {
    res.status(404);
    throw new Error('User not found');
  }
  if (membership.user === req.user._id) {
    res.status(400);
    throw new Error('You cannot remove your own account');
  }
  if (membership.role === 'owner') {
    res.status(400);
    throw new Error('A business must keep at least one owner');
  }

  await db
    .delete(tenantMembers)
    .where(and(eq(tenantMembers._id, membership._id), eq(tenantMembers.tenant, req.tenantId)));

  await logAudit(req, 'member.removed', 'tenant_member', membership._id);

  res.json({ message: 'User removed' });
});

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
