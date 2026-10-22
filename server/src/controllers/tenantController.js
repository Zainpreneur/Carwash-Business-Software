const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { and, count, desc, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { tenants, locations, users, tenantMembers, invites } = require('../db/schema');
const { getTenantContext, listLocations, assertWithinLimits } = require('../services/tenantService');
const { logAudit } = require('../utils/audit');

const ROLES = ['owner', 'admin', 'manager', 'staff'];

const memberSelect = {
  membershipId: tenantMembers._id,
  userId: users._id,
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

const locationSelect = {
  id: locations._id,
  name: locations.name,
  code: locations.code,
  address: locations.address,
  city: locations.city,
  country: locations.country,
  phone: locations.phone,
  timezone: locations.timezone,
  active: locations.active,
  createdAt: locations.createdAt,
};

/**
 * @desc    The signed-in business: profile, plan, features and locations
 * @route   GET /api/tenant/current
 */
const getCurrent = asyncHandler(async (req, res) => {
  const context = await getTenantContext(req.tenant);
  const allLocations = await listLocations(req.tenantId);
  const membership = req.membership;

  res.json({
    ...context,
    role: membership?.role || null,
    membership: membership || null,
    locationId: req.requestedLocationId || membership?.location || null,
    locations: allLocations.map((l) => ({
      id: l._id,
      name: l.name,
      code: l.code,
      address: l.address,
      city: l.city,
      phone: l.phone,
      active: l.active,
    })),
  });
});

/**
 * @desc    Update the business profile / white-label branding
 * @route   PUT /api/tenant/current
 */
const updateCurrent = asyncHandler(async (req, res) => {
  const { name, brandColor, logoUrl, currency, timezone, taxRate, phone, address, settings } = req.body;
  const updates = { updatedAt: new Date() };

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) {
      res.status(400);
      throw new Error('Business name cannot be empty');
    }
    updates.name = trimmed;
  }
  if (brandColor !== undefined) updates.brandColor = String(brandColor);
  if (logoUrl !== undefined) updates.logoUrl = logoUrl || null;
  if (currency !== undefined) updates.currency = String(currency);
  if (timezone !== undefined) updates.timezone = String(timezone);
  if (taxRate !== undefined) updates.taxRate = Number(taxRate) || 0;
  if (phone !== undefined) updates.phone = phone || null;
  if (address !== undefined) updates.address = address || null;
  if (settings !== undefined) updates.settings = settings;

  const [updated] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants._id, req.tenantId))
    .returning();

  await logAudit(req, 'tenant.updated', 'tenant', req.tenantId, { fields: Object.keys(updates) });

  res.json(await getTenantContext(updated));
});

/**
 * @desc    List the locations (branches) of the business
 * @route   GET /api/tenant/current/locations
 */
const getLocations = asyncHandler(async (req, res) => {
  const rows = await db
    .select(locationSelect)
    .from(locations)
    .where(eq(locations.tenant, req.tenantId))
    .orderBy(desc(locations.createdAt));
  res.json(rows);
});

/**
 * @desc    Add a location (branch)
 * @route   POST /api/tenant/current/locations
 */
const createLocation = asyncHandler(async (req, res) => {
  const { name, code, address, city, country, phone, timezone } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Location name is required');
  }

  await assertWithinLimits(req.tenant, 'locations');

  const normalizedCode =
    String(code || name)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'BRANCH';

  const [created] = await db
    .insert(locations)
    .values({
      name: String(name).trim(),
      code: normalizedCode,
      address: address || null,
      city: city || null,
      country: country || null,
      phone: phone || null,
      timezone: timezone || req.tenant.timezone || null,
      active: true,
    })
    .returning();

  await logAudit(req, 'location.created', 'location', created._id, { name: created.name });

  res.status(201).json(created);
});

/**
 * @desc    Update a location
 * @route   PUT /api/tenant/current/locations/:id
 */
const updateLocation = asyncHandler(async (req, res) => {
  const { name, code, address, city, country, phone, timezone, active } = req.body;
  const updates = { updatedAt: new Date() };

  if (name !== undefined) updates.name = String(name).trim();
  if (code !== undefined) updates.code = String(code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  if (address !== undefined) updates.address = address || null;
  if (city !== undefined) updates.city = city || null;
  if (country !== undefined) updates.country = country || null;
  if (phone !== undefined) updates.phone = phone || null;
  if (timezone !== undefined) updates.timezone = timezone || null;
  if (active !== undefined) updates.active = Boolean(active);

  const [updated] = await db
    .update(locations)
    .set(updates)
    .where(and(eq(locations._id, req.params.id), eq(locations.tenant, req.tenantId)))
    .returning();

  if (!updated) {
    res.status(404);
    throw new Error('Location not found');
  }

  await logAudit(req, 'location.updated', 'location', updated._id);
  res.json(updated);
});

/**
 * @desc    Deactivate a location (it keeps its history)
 * @route   DELETE /api/tenant/current/locations/:id
 */
const deleteLocation = asyncHandler(async (req, res) => {
  const [updated] = await db
    .update(locations)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(locations._id, req.params.id), eq(locations.tenant, req.tenantId)))
    .returning();

  if (!updated) {
    res.status(404);
    throw new Error('Location not found');
  }

  await logAudit(req, 'location.deactivated', 'location', updated._id);
  res.json({ message: 'Location deactivated', location: updated });
});

/**
 * @desc    List the members of the business
 * @route   GET /api/tenant/current/members
 */
const getMembers = asyncHandler(async (req, res) => {
  const rows = await db
    .select(memberSelect)
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.user, users._id))
    .where(eq(tenantMembers.tenant, req.tenantId))
    .orderBy(desc(tenantMembers.createdAt));

  res.json(rows);
});

/**
 * @desc    Add a member to the business (invite by email, with a shareable code)
 * @route   POST /api/tenant/current/members
 */
const addMember = asyncHandler(async (req, res) => {
  const { email, role, name, password, location, scopeAllLocations } = req.body;
  const lowered = String(email || '').toLowerCase().trim();

  if (!lowered) {
    res.status(400);
    throw new Error('Email is required');
  }
  const memberRole = ROLES.includes(role) ? role : 'staff';

  let [user] = await db.select().from(users).where(eq(users.email, lowered));

  if (!user) {
    if (!name || !password) {
      res.status(400);
      throw new Error('Name and password are required to create the account');
    }
    [user] = await db
      .insert(users)
      .values({
        name,
        email: lowered,
        password: await bcrypt.hash(password, 10),
        platformRole: 'user',
      })
      .returning();
  }

  const [existing] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, req.tenantId), eq(tenantMembers.user, user._id)));

  if (existing) {
    res.status(400);
    throw new Error('That person is already a member of this business');
  }

  await assertWithinLimits(req.tenant, 'staff');

  const [membership] = await db
    .insert(tenantMembers)
    .values({
      tenant: req.tenantId,
      user: user._id,
      role: memberRole,
      status: 'active',
      location: location || null,
      scopeAllLocations: scopeAllLocations === undefined ? !location : Boolean(scopeAllLocations),
    })
    .returning();

  await logAudit(req, 'member.added', 'tenant_member', membership._id, { email: lowered, role: memberRole });

  res.status(201).json({
    membershipId: membership._id,
    userId: user._id,
    name: user.name,
    email: user.email,
    role: membership.role,
    status: membership.status,
    location: membership.location,
    scopeAllLocations: membership.scopeAllLocations,
  });
});

/**
 * @desc    Change a member's role / status / home location
 * @route   PUT /api/tenant/current/members/:id
 */
const updateMember = asyncHandler(async (req, res) => {
  const { role, status, location, scopeAllLocations } = req.body;

  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers._id, req.params.id), eq(tenantMembers.tenant, req.tenantId)));

  if (!membership) {
    res.status(404);
    throw new Error('Member not found');
  }

  const updates = { updatedAt: new Date() };
  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      res.status(400);
      throw new Error('Unknown role');
    }
    updates.role = role;
  }
  if (status !== undefined) updates.status = status;
  if (location !== undefined) updates.location = location || null;
  if (scopeAllLocations !== undefined) updates.scopeAllLocations = Boolean(scopeAllLocations);

  // Never let the last owner be demoted or removed — the business would be
  // left with nobody able to manage it.
  if (membership.role === 'owner' && (updates.role && updates.role !== 'owner' || updates.status === 'disabled')) {
    const [{ value: ownerCount }] = await db
      .select({ value: count() })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenant, req.tenantId), eq(tenantMembers.role, 'owner')));
    if (Number(ownerCount || 0) <= 1) {
      res.status(400);
      throw new Error('A business must keep at least one owner');
    }
  }

  const [updated] = await db
    .update(tenantMembers)
    .set(updates)
    .where(and(eq(tenantMembers._id, req.params.id), eq(tenantMembers.tenant, req.tenantId)))
    .returning();

  await logAudit(req, 'member.updated', 'tenant_member', updated._id, updates);

  res.json({
    membershipId: updated._id,
    role: updated.role,
    status: updated.status,
    location: updated.location,
    scopeAllLocations: updated.scopeAllLocations,
  });
});

/**
 * @desc    Remove a member from the business
 * @route   DELETE /api/tenant/current/members/:id
 */
const removeMember = asyncHandler(async (req, res) => {
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers._id, req.params.id), eq(tenantMembers.tenant, req.tenantId)));

  if (!membership) {
    res.status(404);
    throw new Error('Member not found');
  }
  if (membership.user === req.user._id) {
    res.status(400);
    throw new Error('You cannot remove yourself from the business');
  }
  if (membership.role === 'owner') {
    const [{ value: ownerCount }] = await db
      .select({ value: count() })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenant, req.tenantId), eq(tenantMembers.role, 'owner')));
    if (Number(ownerCount || 0) <= 1) {
      res.status(400);
      throw new Error('A business must keep at least one owner');
    }
  }

  await db
    .delete(tenantMembers)
    .where(and(eq(tenantMembers._id, req.params.id), eq(tenantMembers.tenant, req.tenantId)));

  await logAudit(req, 'member.removed', 'tenant_member', req.params.id);

  res.json({ message: 'Member removed' });
});

/**
 * @desc    Create an invite code a new member can redeem
 * @route   POST /api/tenant/current/invites
 */
const createInvite = asyncHandler(async (req, res) => {
  const { email, role, location } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const code = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

  const [invite] = await db
    .insert(invites)
    .values({
      tenant: req.tenantId,
      email: String(email).toLowerCase().trim(),
      role: ROLES.includes(role) ? role : 'staff',
      location: location || null,
      code,
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  res.status(201).json({
    code: invite.code,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
});

/**
 * @desc    List pending invites
 * @route   GET /api/tenant/current/invites
 */
const getInvites = asyncHandler(async (req, res) => {
  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.tenant, req.tenantId))
    .orderBy(desc(invites.createdAt));
  res.json(rows);
});

module.exports = {
  getCurrent,
  updateCurrent,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getMembers,
  addMember,
  updateMember,
  removeMember,
  createInvite,
  getInvites,
};
