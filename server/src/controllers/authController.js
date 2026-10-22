const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { and, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, tenants, tenantMembers, invites } = require('../db/schema');
const { runAsPlatform } = require('../db/tenantDb');
const generateToken = require('../utils/generateToken');
const { createTenant, getTenantContext, listUserTenants } = require('../services/tenantService');

const hashPassword = (plain) => bcrypt.hash(plain, 10);

const publicUser = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
};

/**
 * @desc    Create a business (self-serve signup). This is the SaaS entry point:
 *          one call creates the login, the business, its first location and its
 *          starter price list. The new account is the owner of that business.
 * @route   POST /api/auth/signup
 */
const signup = asyncHandler(async (req, res) => {
  const { businessName, name, email, password, phone, plan } = req.body;

  if (!businessName || !String(businessName).trim()) {
    res.status(400);
    throw new Error('Business name is required');
  }
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const lowered = String(email).toLowerCase().trim();
  const existing = await db.select({ _id: users._id }).from(users).where(eq(users.email, lowered));
  if (existing.length) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const result = await runAsPlatform(async () => {
    const [user] = await db
      .insert(users)
      .values({
        name: String(name).trim(),
        email: lowered,
        password: await hashPassword(password),
        phone: phone || null,
        platformRole: 'user',
      })
      .returning();

    const { tenant } = await createTenant({
      name: String(businessName).trim(),
      planCode: plan || 'starter',
      owner: user,
    });

    return { user, tenant };
  });

  const context = await getTenantContext(result.tenant);

  res.status(201).json({
    user: publicUser(result.user),
    tenant: context,
    role: 'owner',
    token: generateToken(result.user._id, result.tenant._id),
  });
});

/**
 * @desc    Register a staff account inside an existing business (owner/admin only).
 * @route   POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const lowered = String(email || '').toLowerCase().trim();
  if (!name || !lowered || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }

  const existing = await db.select({ _id: users._id }).from(users).where(eq(users.email, lowered));
  if (existing.length) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: lowered,
      password: await hashPassword(password),
      phone: phone || null,
      platformRole: 'user',
    })
    .returning();

  const [membership] = await db
    .insert(tenantMembers)
    .values({
      tenant: req.tenantId,
      user: user._id,
      role: ['owner', 'admin', 'manager', 'staff'].includes(role) ? role : 'staff',
      status: 'active',
      scopeAllLocations: true,
    })
    .returning();

  res.status(201).json({
    user: publicUser(user),
    membership,
    role: membership.role,
    token: generateToken(user._id, req.tenantId),
  });
});

/**
 * @desc    Auth user & get token
 * @route   POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, tenantSlug } = req.body;

  const lowered = String(email || '').toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, lowered));
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.active) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  const memberships = await listUserTenants(user._id);

  // The SaaS operator signs into the platform console, not into a business.
  if (user.platformRole === 'platform_admin') {
    return res.json({
      user: publicUser(user),
      role: 'platform_admin',
      platformRole: 'platform_admin',
      tenant: null,
      tenants: memberships.map((m) => ({
        _id: m._id,
        name: m.name,
        slug: m.slug,
        logoUrl: m.logoUrl,
        brandColor: m.brandColor,
        role: m.role,
        plan: m.plan,
      })),
      token: generateToken(user._id, null),
    });
  }

  if (!memberships.length) {
    res.status(403);
    throw new Error('This account is not connected to a business yet. Create one or ask for an invite.');
  }

  // Pick the business the user wants to work in: the one they asked for, else
  // the one they were last active in, else their first.
  let active = null;
  if (tenantSlug) {
    active = memberships.find((m) => m.slug === String(tenantSlug).toLowerCase()) || null;
    if (!active) {
      res.status(403);
      throw new Error('You do not have access to that business');
    }
  }
  if (!active) active = memberships[0];

  const [tenant] = await db.select().from(tenants).where(eq(tenants._id, active._id));
  const context = await getTenantContext(tenant);

  res.json({
    user: publicUser(user),
    role: active.role,
    tenant: context,
    tenants: memberships.map((m) => ({
      _id: m._id,
      name: m.name,
      slug: m.slug,
      logoUrl: m.logoUrl,
      brandColor: m.brandColor,
      role: m.role,
      plan: m.plan,
    })),
    token: generateToken(user._id, active._id),
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const memberships = await listUserTenants(req.user._id);
  const context = await getTenantContext(req.tenant);

  res.json({
    user: publicUser(req.user),
    role: req.membership?.role || req.role || null,
    platformRole: req.user.platformRole,
    tenant: context,
    membership: req.membership || null,
    tenants: memberships.map((m) => ({
      _id: m._id,
      name: m.name,
      slug: m.slug,
      logoUrl: m.logoUrl,
      brandColor: m.brandColor,
      role: m.role,
      plan: m.plan,
    })),
    location: req.requestedLocationId || req.membership?.location || null,
  });
});

/**
 * @desc    Switch the active business (issues a token bound to it)
 * @route   POST /api/auth/switch-tenant
 */
const switchTenant = asyncHandler(async (req, res) => {
  const { tenantSlug } = req.body;
  const slug = String(tenantSlug || '').toLowerCase();
  if (!slug) {
    res.status(400);
    throw new Error('tenantSlug is required');
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, tenant._id), eq(tenantMembers.user, req.user._id)));

  if (!membership || membership.status !== 'active') {
    res.status(403);
    throw new Error('You do not have access to that business');
  }

  res.json({
    tenant: await getTenantContext(tenant),
    role: membership.role,
    token: generateToken(req.user._id, tenant._id),
  });
});

/**
 * @desc    Accept an invitation to join a business
 * @route   POST /api/auth/accept-invite
 */
const acceptInvite = asyncHandler(async (req, res) => {
  const { code, name, password, phone } = req.body;
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    res.status(400);
    throw new Error('Invite code is required');
  }

  const [invite] = await db.select().from(invites).where(eq(invites.code, normalized));
  if (!invite) {
    res.status(404);
    throw new Error('Invite code not found');
  }
  if (invite.acceptedAt) {
    res.status(400);
    throw new Error('This invite has already been used');
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    res.status(400);
    throw new Error('This invite has expired');
  }

  const email = String(invite.email).toLowerCase().trim();
  let [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    if (!name || !password) {
      res.status(400);
      throw new Error('Name and password are required to create your account');
    }
    [user] = await db
      .insert(users)
      .values({
        name,
        email,
        password: await hashPassword(password),
        phone: phone || null,
        platformRole: 'user',
      })
      .returning();
  }

  const [existingMembership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, invite.tenant), eq(tenantMembers.user, user._id)));

  if (!existingMembership) {
    await db.insert(tenantMembers).values({
      tenant: invite.tenant,
      user: user._id,
      role: invite.role || 'staff',
      status: 'active',
      location: invite.location || null,
      scopeAllLocations: !invite.location,
    });
  }

  await db
    .update(invites)
    .set({ acceptedAt: new Date(), acceptedBy: user._id })
    .where(eq(invites._id, invite._id));

  const [tenant] = await db.select().from(tenants).where(eq(tenants._id, invite.tenant));

  res.json({
    user: publicUser(user),
    tenant: await getTenantContext(tenant),
    role: invite.role || 'staff',
    token: generateToken(user._id, invite.tenant),
  });
});

module.exports = { signup, register, login, getMe, switchTenant, acceptInvite };
