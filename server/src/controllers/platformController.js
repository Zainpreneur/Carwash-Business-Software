const asyncHandler = require('express-async-handler');
const { count, desc, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { tenants, tenantMembers, tenantSubscriptions, locations, users } = require('../db/schema');
const { runAsPlatform } = require('../db/tenantDb');
const { createTenant, getTenantContext } = require('../services/tenantService');
const { listPlans } = require('../services/plans');

/**
 * The SaaS operator's console.
 *
 * Everything here runs in platform scope: it deliberately reads across every
 * business. It is guarded by `platformOnly`, which checks the caller's
 * `platformRole` — a role that only the SaaS operator's own staff have.
 */

const listTenants = asyncHandler(async (req, res) => {
  const rows = await runAsPlatform(async () => {
    const all = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
    const memberships = await db.select().from(tenantMembers);
    const subscriptions = await db.select().from(tenantSubscriptions);
    const siteRows = await db.select().from(locations);

    return all.map((tenant) => ({
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
      brandColor: tenant.brandColor,
      logoUrl: tenant.logoUrl,
      currency: tenant.currency,
      timezone: tenant.timezone,
      createdAt: tenant.createdAt,
      members: memberships.filter((m) => m.tenant === tenant._id).length,
      locations: siteRows.filter((l) => l.tenant === tenant._id).length,
      subscription: subscriptions.find((s) => s.tenant === tenant._id) || null,
    }));
  });

  res.json(rows);
});

const getTenant = asyncHandler(async (req, res) => {
  const detail = await runAsPlatform(async () => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants._id, req.params.id));
    if (!tenant) return null;

    const members = await db
      .select({
        membershipId: tenantMembers._id,
        role: tenantMembers.role,
        status: tenantMembers.status,
        createdAt: tenantMembers.createdAt,
        userId: users._id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.user, users._id))
      .where(eq(tenantMembers.tenant, tenant._id));

    const sites = await db.select().from(locations).where(eq(locations.tenant, tenant._id));
    const context = await getTenantContext(tenant);

    return { ...context, members, locationRows: sites };
  });

  if (!detail) {
    res.status(404);
    throw new Error('Business not found');
  }
  res.json(detail);
});

const updateTenant = asyncHandler(async (req, res) => {
  const { status, plan, name } = req.body;

  const updated = await runAsPlatform(async () => {
    const updates = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (plan !== undefined) updates.plan = plan;
    if (name !== undefined) updates.name = String(name).trim();

    const [row] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants._id, req.params.id))
      .returning();

    if (row && plan !== undefined) {
      await db
        .update(tenantSubscriptions)
        .set({ plan, updatedAt: new Date() })
        .where(eq(tenantSubscriptions.tenant, req.params.id));
    }

    return row;
  });

  if (!updated) {
    res.status(404);
    throw new Error('Business not found');
  }
  res.json(await getTenantContext(updated));
});

/**
 * Provision a business manually (the operator signs a customer up for them).
 */
const createTenantForCustomer = asyncHandler(async (req, res) => {
  const { businessName, ownerName, ownerEmail, ownerPassword, plan } = req.body;

  if (!businessName || !ownerEmail) {
    res.status(400);
    throw new Error('Business name and owner email are required');
  }

  const lowered = String(ownerEmail).toLowerCase().trim();
  const [existing] = await db.select().from(users).where(eq(users.email, lowered));

  const result = await runAsPlatform(async () => {
    let owner = existing;
    if (!owner) {
      const bcrypt = require('bcryptjs');
      [owner] = await db
        .insert(users)
        .values({
          name: ownerName || ownerEmail,
          email: lowered,
          password: await bcrypt.hash(ownerPassword || 'welcome123', 10),
          platformRole: 'user',
        })
        .returning();
    }
    return createTenant({ name: businessName, planCode: plan || 'starter', owner });
  });

  res.status(201).json({
    tenant: await getTenantContext(result.tenant),
    owner: { email: lowered },
  });
});

const stats = asyncHandler(async (req, res) => {
  const data = await runAsPlatform(async () => {
    const [tenantCount] = await db.select({ value: count() }).from(tenants);
    const [memberCount] = await db.select({ value: count() }).from(tenantMembers);
    const [locationCount] = await db.select({ value: count() }).from(locations);
    const [userCount] = await db.select({ value: count() }).from(users);
    const all = await db.select().from(tenants);
    const byStatus = all.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    const byPlan = all.reduce((acc, t) => {
      acc[t.plan] = (acc[t.plan] || 0) + 1;
      return acc;
    }, {});
    return {
      tenants: Number(tenantCount?.value || 0),
      members: Number(memberCount?.value || 0),
      locations: Number(locationCount?.value || 0),
      users: Number(userCount?.value || 0),
      byStatus,
      byPlan,
    };
  });

  res.json(data);
});

const plans = asyncHandler(async (req, res) => {
  res.json(await listPlans());
});

module.exports = { listTenants, getTenant, updateTenant, createTenantForCustomer, stats, plans };
