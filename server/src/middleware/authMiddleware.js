const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { and, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, tenants, tenantMembers } = require('../db/schema');
const { runWithTenant, runAsPlatform } = require('../db/tenantDb');

// Roles inside a business, ordered by how much they can do.
// A user can be `owner` of one car wash and `staff` of another — the role
// always belongs to the membership, never to the login.
const ROLE_RANK = {
  staff: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

const roleAtLeast = (role, minimum) => (ROLE_RANK[role] || 0) >= (ROLE_RANK[minimum] || 99);

/**
 * Authenticate the caller and bind the request to a business.
 *
 * After this middleware runs:
 *   req.user       — the platform login (never carries a business role)
 *   req.tenant    — the business the request is acting in
 *   req.membership — the caller's membership row in that business
 *   req.role      — the caller's role *in that business*
 *
 * Everything downstream runs inside the tenant context, so the data layer
 * scopes every query to `req.tenant` automatically.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }

  const [user] = await db.select().from(users).where(eq(users._id, decoded.id));
  if (!user || !user.active) {
    res.status(401);
    throw new Error('Not authorized, user not found or inactive');
  }
  req.user = user;

  // A business was named explicitly but does not exist (deleted, renamed, or a
  // stale link). Answering 404 is clearer than silently serving another one.
  if (req.tenantRequested && !req.tenant) {
    res.status(404);
    throw new Error(`Business '${req.tenantRequested}' was not found`);
  }

  // --- Which business is this request for? --------------------------------
  const explicitTenant = Boolean(req.tenant);
  let tenant = req.tenant || null;
  let membership = null;

  if (tenant) {
    [membership] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenant, tenant._id), eq(tenantMembers.user, user._id)));
  }

  if (!membership && !explicitTenant && decoded.tid) {
    const [byId] = await db.select().from(tenants).where(eq(tenants._id, decoded.tid));
    if (byId) {
      const [row] = await db
        .select()
        .from(tenantMembers)
        .where(and(eq(tenantMembers.tenant, byId._id), eq(tenantMembers.user, user._id)));
      if (row) {
        tenant = byId;
        membership = row;
      }
    }
  }

  if (!membership && !explicitTenant) {
    const memberships = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.user, user._id), eq(tenantMembers.status, 'active')));
    if (memberships.length) {
      membership = memberships[0];
      const [found] = await db.select().from(tenants).where(eq(tenants._id, membership.tenant));
      tenant = found || null;
    }
  }

  if (!membership) {
    // The SaaS operator is not a member of any business — they work across all
    // of them. When they name a business (header/subdomain/path) the request
    // runs inside that business; otherwise it runs with platform privileges.
    if (user.platformRole === 'platform_admin') {
      req.tenant = tenant || null;
      req.tenantId = tenant?._id || null;
      req.membership = null;
      req.role = 'platform_admin';

      if (req.tenantId) {
        return runWithTenant(req.tenantId, () => next(), {
          locationId: req.requestedLocationId || null,
        });
      }
      return runAsPlatform(() => next());
    }

    if (explicitTenant) {
      res.status(403);
      throw new Error('You do not have access to this business');
    }
    res.status(403);
    throw new Error('You are not a member of any business yet');
  }

  if (membership.status !== 'active') {
    res.status(403);
    throw new Error('Your access to this business has been suspended');
  }

  if (tenant && tenant.status === 'suspended') {
    res.status(403);
    throw new Error('This business account is suspended. Please contact support.');
  }

  req.tenant = tenant;
  req.tenantId = tenant?._id || membership.tenant;
  req.membership = membership;
  req.role = membership.role;

  // Bind the request to this business for the rest of the pipeline.
  return runWithTenant(req.tenantId, () => next(), {
    locationId: req.requestedLocationId || membership.location || null,
  });
});

/**
 * Role gate. `authorize('manager')` also allows admins and owners — the role
 * list states the *minimum* privilege required.
 */
const authorize = (...roles) => (req, res, next) => {
  const role = req.membership?.role;
  const allowed = roles.some((minimum) => roleAtLeast(role, minimum));
  if (!req.user || !allowed) {
    res.status(403);
    throw new Error(`Role '${role || 'guest'}' is not permitted for this action`);
  }
  next();
};

/** Only the SaaS operator (platform admin) may use this. */
const platformOnly = (req, res, next) => {
  if (!req.user || req.user.platformRole !== 'platform_admin') {
    res.status(403);
    throw new Error('Platform administrator access required');
  }
  next();
};

module.exports = { protect, authorize, platformOnly, roleAtLeast, ROLE_RANK };
