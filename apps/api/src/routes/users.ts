import { tenantMembers, tenants, users } from '@carwash/db/schema';
import { updateUserSchema } from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth)

  .get('/me', async (c) => {
    const user = c.get('user')!;
    const [row] = await platformDb.select().from(users).where(eq(users.id, user.id)).limit(1);
    return c.json({ data: row });
  })

  /** Businesses the signed-in user belongs to (used by the tenant switcher). */
  .get('/me/tenants', async (c) => {
    const user = c.get('user')!;
    const rows = await platformDb
      .select({
        _id: tenants._id,
        name: tenants.name,
        slug: tenants.slug,
        logoUrl: tenants.logoUrl,
        brandColor: tenants.brandColor,
        status: tenants.status,
        plan: tenants.plan,
        role: tenantMembers.role,
        scopeAllLocations: tenantMembers.scopeAllLocations,
        locationId: tenantMembers.location,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenants._id, tenantMembers.tenant))
      .where(and(eq(tenantMembers.user, user.id), eq(tenantMembers.status, 'active')))
      .orderBy(tenants.name);
    return c.json({ data: rows });
  })

  .patch('/me', zValidator('json', updateUserSchema), async (c) => {
    const user = c.get('user')!;
    const [row] = await platformDb
      .update(users)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return c.json({ data: row });
  });
export default router;
