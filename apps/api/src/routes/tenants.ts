import { locations, tenantMembers, tenants, users } from '@carwash/db/schema';
import {
  createLocationSchema,
  inviteMemberSchema,
  updateLocationSchema,
  updateMemberSchema,
  updateTenantSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  // ------------------------------ Current tenant ----------------------------

  .get('/', async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .select()
      .from(tenants)
      .where(eq(tenants._id, tenant.id))
      .limit(1);
    return c.json({ data: { ...row, role: tenant.role, locationId: tenant.locationId } });
  })

  .patch('/', requireRole('admin'), zValidator('json', updateTenantSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .update(tenants)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(eq(tenants._id, tenant.id))
      .returning();
    return c.json({ data: row });
  })

  // -------------------------------- Locations -------------------------------

  .get('/locations', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(locations)
      .where(eq(locations.tenant, tenant.id))
      .orderBy(locations.name);
    return c.json({ data: rows });
  })

  .post('/locations', requireRole('admin'), zValidator('json', createLocationSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .insert(locations)
      .values({ ...c.req.valid('json'), tenant: tenant.id })
      .returning();
    return c.json({ data: row }, 201);
  })

  .patch(
    '/locations/:id',
    requireRole('admin'),
    zValidator('json', updateLocationSchema),
    async (c) => {
      const tenant = c.get('tenant')!;
      const [row] = await platformDb
        .update(locations)
        .set({ ...c.req.valid('json'), updatedAt: new Date() })
        .where(and(eq(locations.tenant, tenant.id), eq(locations._id, c.req.param('id'))))
        .returning();
      if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ data: row });
    }
  )

  .delete('/locations/:id', requireRole('admin'), async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .delete(locations)
      .where(and(eq(locations.tenant, tenant.id), eq(locations._id, c.req.param('id'))))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ ok: true });
  })

  // --------------------------------- Members --------------------------------

  .get('/members', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select({
        id: tenantMembers._id,
        role: tenantMembers.role,
        status: tenantMembers.status,
        scopeAllLocations: tenantMembers.scopeAllLocations,
        locationId: tenantMembers.location,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.user))
      .where(eq(tenantMembers.tenant, tenant.id));
    return c.json({ data: rows });
  })

  .post('/members', requireRole('admin'), zValidator('json', inviteMemberSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const input = c.req.valid('json');
    const [existingUser] = await platformDb
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);
    if (!existingUser) {
      // Invitations to brand-new users require an email flow — out of scope here.
      return c.json(
        {
          error: {
            code: 'user_not_found',
            message: 'No account with that email yet. Ask them to sign up first.',
          },
        },
        404
      );
    }
    const [row] = await platformDb
      .insert(tenantMembers)
      .values({
        tenant: tenant.id,
        user: existingUser.id,
        role: input.role,
        location: input.locationId ?? null,
        scopeAllLocations: !input.locationId,
        status: 'active',
      })
      .returning();
    return c.json({ data: row }, 201);
  })

  .patch(
    '/members/:id',
    requireRole('admin'),
    zValidator('json', updateMemberSchema),
    async (c) => {
      const tenant = c.get('tenant')!;
      const input = c.req.valid('json');
      const [row] = await platformDb
        .update(tenantMembers)
        .set({
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.locationId !== undefined ? { location: input.locationId } : {}),
          ...(input.scopeAllLocations !== undefined
            ? { scopeAllLocations: input.scopeAllLocations }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(tenantMembers.tenant, tenant.id), eq(tenantMembers._id, c.req.param('id'))))
        .returning();
      if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ data: row });
    }
  )

  .delete('/members/:id', requireRole('admin'), async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenant, tenant.id), eq(tenantMembers._id, c.req.param('id'))))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ ok: true });
  });
export default router;
