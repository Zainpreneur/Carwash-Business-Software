import { packagePricing, washPackages } from '@carwash/db/schema';
import { createWashPackageSchema, updateWashPackageSchema } from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

async function withPricing(tenantId: string, pkg: typeof washPackages.$inferSelect) {
  const pricing = await platformDb
    .select()
    .from(packagePricing)
    .where(and(eq(packagePricing.tenant, tenantId), eq(packagePricing.package, pkg._id)));
  return { ...pkg, pricing };
}

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  .get('/', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(washPackages)
      .where(eq(washPackages.tenant, tenant.id));
    return c.json({ data: await Promise.all(rows.map((r) => withPricing(tenant.id, r))) });
  })

  .get('/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [pkg] = await platformDb
      .select()
      .from(washPackages)
      .where(and(eq(washPackages.tenant, tenant.id), eq(washPackages._id, c.req.param('id'))))
      .limit(1);
    if (!pkg) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: await withPricing(tenant.id, pkg) });
  })

  .post('/', requireRole('manager'), zValidator('json', createWashPackageSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const { pricing, ...rest } = c.req.valid('json');
    const [pkg] = await platformDb
      .insert(washPackages)
      .values({ ...rest, tenant: tenant.id })
      .returning();
    if (!pkg) return c.json({ error: { code: 'internal_error', message: 'Insert failed' } }, 500);

    await platformDb
      .insert(packagePricing)
      .values(pricing.map((p) => ({ ...p, tenant: tenant.id, package: pkg._id })));
    return c.json({ data: await withPricing(tenant.id, pkg) }, 201);
  })

  .patch('/:id', requireRole('manager'), zValidator('json', updateWashPackageSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const { pricing, ...rest } = c.req.valid('json');
    const [pkg] = await platformDb
      .update(washPackages)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(washPackages.tenant, tenant.id), eq(washPackages._id, c.req.param('id'))))
      .returning();
    if (!pkg) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);

    if (pricing) {
      await platformDb
        .delete(packagePricing)
        .where(and(eq(packagePricing.tenant, tenant.id), eq(packagePricing.package, pkg._id)));
      await platformDb
        .insert(packagePricing)
        .values(pricing.map((p) => ({ ...p, tenant: tenant.id, package: pkg._id })));
    }
    return c.json({ data: await withPricing(tenant.id, pkg) });
  })

  .delete('/:id', requireRole('manager'), async (c) => {
    const tenant = c.get('tenant')!;
    const [pkg] = await platformDb
      .delete(washPackages)
      .where(and(eq(washPackages.tenant, tenant.id), eq(washPackages._id, c.req.param('id'))))
      .returning();
    if (!pkg) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ ok: true });
  });
export default router;
