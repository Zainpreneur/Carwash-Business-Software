import { tenantMembers, tenantSubscriptions, tenants } from '@carwash/db/schema';
import { onboardingSchema } from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { provisionStarterData } from '../lib/onboarding.js';
import { uniqueSlug } from '../lib/slug.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth)

  /**
   * Self-serve onboarding: create a business owned by the signed-in user,
   * including the starter price list so the app is immediately usable.
   */
  .post('/', zValidator('json', onboardingSchema), async (c) => {
    const user = c.get('user')!;
    const input = c.req.valid('json');

    const existing = await platformDb.select({ slug: tenants.slug }).from(tenants);
    const slug = uniqueSlug(input.businessName, new Set(existing.map((row) => row.slug)));

    const [tenant] = await platformDb
      .insert(tenants)
      .values({
        name: input.businessName,
        slug,
        status: 'trial',
        plan: 'starter',
        currency: input.currency,
        timezone: input.timezone,
      })
      .returning();
    if (!tenant) {
      return c.json(
        { error: { code: 'internal_error', message: 'Could not create business' } },
        500
      );
    }

    try {
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
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const starter = await provisionStarterData(tenant._id);
      return c.json({ data: { tenant, locationId: starter.locationId } }, 201);
    } catch (err) {
      logger.error({ err, tenantId: tenant._id }, 'onboarding failed; rolling back tenant');
      await platformDb.delete(tenants).where(eq(tenants._id, tenant._id));
      return c.json(
        { error: { code: 'onboarding_failed', message: 'Could not finish setting up business' } },
        500
      );
    }
  });

export default router;
