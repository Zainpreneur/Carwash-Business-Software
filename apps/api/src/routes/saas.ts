import { saasPlans, tenantMembers, tenantSubscriptions, tenants, users } from '@carwash/db/schema';
import { createTenantSchema, saasPlanSchema } from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';
import type { AppEnv } from '../middleware/types.js';

// --------------------------- Platform admin routes ------------------------

const admin = new Hono<AppEnv>()
  .use('*', requireAuth, requirePlatformAdmin)
  .get('/tenants', async (c) => {
    const rows = await platformDb.select().from(tenants).orderBy(tenants.createdAt);
    return c.json({ data: rows });
  })

  /** Provision a new tenant business and make the caller its owner. */
  .post('/tenants', zValidator('json', createTenantSchema), async (c) => {
    const user = c.get('user')!;
    const input = c.req.valid('json');

    const [existing] = await platformDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, input.slug.toLowerCase()))
      .limit(1);
    if (existing) {
      return c.json({ error: { code: 'conflict', message: 'That slug is already taken' } }, 409);
    }

    const [tenant] = await platformDb
      .insert(tenants)
      .values({
        name: input.name,
        slug: input.slug.toLowerCase(),
        currency: input.currency,
        timezone: input.timezone,
        phone: input.phone,
        address: input.address,
        status: 'trial',
      })
      .returning();
    if (!tenant)
      return c.json({ error: { code: 'internal_error', message: 'Provisioning failed' } }, 500);

    await platformDb.insert(tenantMembers).values({
      tenant: tenant._id,
      user: user.id,
      role: 'owner',
      status: 'active',
      scopeAllLocations: true,
    });

    await platformDb.insert(tenantSubscriptions).values({
      tenant: tenant._id,
      plan: 'starter',
      status: 'trialing',
      seats: 1,
    });

    return c.json({ data: tenant }, 201);
  })
  .get('/stats', async (c) => {
    const [tenantCount] = await platformDb.select({ count: sql<number>`count(*)` }).from(tenants);
    const [userCount] = await platformDb.select({ count: sql<number>`count(*)` }).from(users);
    const byStatus = await platformDb
      .select({ status: tenants.status, count: sql<number>`count(*)` })
      .from(tenants)
      .groupBy(tenants.status);
    return c.json({
      data: {
        tenants: Number(tenantCount?.count ?? 0),
        users: Number(userCount?.count ?? 0),
        byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      },
    });
  })
  .get('/plans', async (c) => {
    const rows = await platformDb.select().from(saasPlans).orderBy(saasPlans.sortOrder);
    return c.json({ data: rows });
  })
  .post('/plans', zValidator('json', saasPlanSchema), async (c) => {
    const [row] = await platformDb.insert(saasPlans).values(c.req.valid('json')).returning();
    return c.json({ data: row }, 201);
  })
  .patch('/plans/:id', zValidator('json', saasPlanSchema.partial()), async (c) => {
    const [row] = await platformDb
      .update(saasPlans)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(saasPlans._id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: row });
  });

// ------------------------------- Public plans -----------------------------

const router = new Hono<AppEnv>()
  .get('/plans', async (c) => {
    const rows = await platformDb
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.active, true))
      .orderBy(saasPlans.sortOrder);
    return c.json({ data: rows });
  })
  .route('/admin', admin);

export default router;
