import { membershipPlans, membershipSubscriptions } from '@carwash/db/schema';
import {
  createMembershipSubscriptionSchema,
  updateMembershipSubscriptionSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

function nextBillingDate(dayOfMonth: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  return next;
}

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  .get('/', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.tenant, tenant.id));
    return c.json({ data: rows });
  })

  .get('/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .select()
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.tenant, tenant.id),
          eq(membershipSubscriptions._id, c.req.param('id'))
        )
      )
      .limit(1);
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: row });
  })

  .post(
    '/',
    requireRole('manager'),
    zValidator('json', createMembershipSubscriptionSchema),
    async (c) => {
      const tenant = c.get('tenant')!;
      const input = c.req.valid('json');

      const [plan] = await platformDb
        .select()
        .from(membershipPlans)
        .where(and(eq(membershipPlans.tenant, tenant.id), eq(membershipPlans._id, input.planId)))
        .limit(1);
      if (!plan) return c.json({ error: { code: 'not_found', message: 'Plan not found' } }, 404);

      // Enforce one active subscription per vehicle.
      const existing = await platformDb
        .select()
        .from(membershipSubscriptions)
        .where(
          and(
            eq(membershipSubscriptions.tenant, tenant.id),
            eq(membershipSubscriptions.vehicle, input.vehicleId),
            eq(membershipSubscriptions.status, 'active')
          )
        )
        .limit(1);
      if (existing.length) {
        return c.json(
          { error: { code: 'conflict', message: 'This vehicle already has an active membership' } },
          409
        );
      }

      const [sub] = await platformDb
        .insert(membershipSubscriptions)
        .values({
          tenant: tenant.id,
          customer: input.customerId,
          vehicle: input.vehicleId,
          plan: plan._id,
          billingDayOfMonth: input.billingDayOfMonth,
          nextBillingDate: nextBillingDate(input.billingDayOfMonth),
        })
        .returning();
      return c.json({ data: sub }, 201);
    }
  )

  .patch(
    '/:id',
    requireRole('manager'),
    zValidator('json', updateMembershipSubscriptionSchema),
    async (c) => {
      const tenant = c.get('tenant')!;
      const [updated] = await platformDb
        .update(membershipSubscriptions)
        .set({ ...c.req.valid('json'), updatedAt: new Date() })
        .where(
          and(
            eq(membershipSubscriptions.tenant, tenant.id),
            eq(membershipSubscriptions._id, c.req.param('id'))
          )
        )
        .returning();
      if (!updated) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ data: updated });
    }
  )

  /** Redeem one wash against a membership. */
  .post('/:id/redeem', async (c) => {
    const tenant = c.get('tenant')!;
    const [sub] = await platformDb
      .select()
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.tenant, tenant.id),
          eq(membershipSubscriptions._id, c.req.param('id'))
        )
      )
      .limit(1);
    if (!sub) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    if (sub.status !== 'active') {
      return c.json(
        { error: { code: 'invalid_state', message: `Membership is ${sub.status}` } },
        422
      );
    }
    const [plan] = await platformDb
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans._id, sub.plan))
      .limit(1);

    if (
      plan &&
      !plan.isUnlimited &&
      plan.washesPerMonthCap != null &&
      sub.washesThisCycle >= plan.washesPerMonthCap
    ) {
      return c.json({ error: { code: 'cap_reached', message: 'Monthly wash cap reached' } }, 422);
    }

    const [updated] = await platformDb
      .update(membershipSubscriptions)
      .set({ washesThisCycle: sub.washesThisCycle + 1, updatedAt: new Date() })
      .where(eq(membershipSubscriptions._id, sub._id))
      .returning();
    return c.json({ data: updated });
  });
export default router;
