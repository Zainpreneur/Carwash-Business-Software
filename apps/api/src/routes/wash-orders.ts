import {
  customers,
  packagePricing,
  serviceBays,
  vehicles,
  washOrders,
  washPackages,
} from '@carwash/db/schema';
import { WASH_ORDER_TRANSITIONS, type WashOrderStatus } from '@carwash/shared/constants';
import {
  createWashOrderSchema,
  paginationSchema,
  washOrderTransitionSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

function pricingTier(vehicleType: string): string {
  if (['suv', 'truck'].includes(vehicleType)) return 'suv-truck';
  if (['van'].includes(vehicleType)) return 'van-oversized';
  return 'sedan-coupe';
}

async function nextOrderNumber(tenantId: string): Promise<string> {
  const [row] = await platformDb
    .select({ count: sql<number>`count(*)` })
    .from(washOrders)
    .where(eq(washOrders.tenant, tenantId));
  const n = Number(row?.count ?? 0) + 1;
  return `WO-${String(n).padStart(5, '0')}`;
}

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  /** Map vehicle type to the pricing tier used by package_pricing. */
  .get('/', async (c) => {
    const tenant = c.get('tenant')!;
    const parsed = paginationSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query' } }, 400);
    }
    const { page, limit, sortDir } = parsed.data;
    const status = c.req.query('status');
    const locationId = c.req.query('locationId');

    const conditions = [eq(washOrders.tenant, tenant.id)];
    if (status) conditions.push(eq(washOrders.status, status));
    if (locationId) conditions.push(eq(washOrders.location, locationId));

    const rows = await platformDb
      .select()
      .from(washOrders)
      .where(and(...conditions))
      .orderBy(sortDir === 'asc' ? washOrders.queuedAt : desc(washOrders.queuedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [counted] = await platformDb
      .select({ count: sql<number>`count(*)` })
      .from(washOrders)
      .where(and(...conditions));
    const total = Number(counted?.count ?? 0);
    return c.json({
      data: rows,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })

  .get('/board', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(washOrders)
      .where(eq(washOrders.tenant, tenant.id))
      .orderBy(washOrders.queuedAt);
    // Group by status for the wash-floor board.
    const board: Record<string, typeof rows> = {};
    for (const t of Object.keys(WASH_ORDER_TRANSITIONS)) board[t] = [];
    for (const row of rows) {
      if (!board[row.status]) board[row.status] = [];
      board[row.status]?.push(row);
    }
    return c.json({ data: board });
  })

  .post('/', zValidator('json', createWashOrderSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const input = c.req.valid('json');
    const user = c.get('user')!;

    const [vehicle] = await platformDb
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.tenant, tenant.id), eq(vehicles._id, input.vehicleId)))
      .limit(1);
    if (!vehicle)
      return c.json({ error: { code: 'not_found', message: 'Vehicle not found' } }, 404);

    const [pkg] = await platformDb
      .select()
      .from(washPackages)
      .where(and(eq(washPackages.tenant, tenant.id), eq(washPackages._id, input.packageId)))
      .limit(1);
    if (!pkg) return c.json({ error: { code: 'not_found', message: 'Package not found' } }, 404);

    const tier = pricingTier(vehicle.type);
    const [priceRow] = await platformDb
      .select()
      .from(packagePricing)
      .where(
        and(
          eq(packagePricing.tenant, tenant.id),
          eq(packagePricing.package, pkg._id),
          eq(packagePricing.vehicleType, tier)
        )
      )
      .limit(1);

    const [order] = await platformDb
      .insert(washOrders)
      .values({
        tenant: tenant.id,
        location: input.locationId ?? tenant.locationId,
        orderNumber: await nextOrderNumber(tenant.id),
        customer: input.customerId ?? vehicle.customer,
        vehicle: vehicle._id,
        package: pkg._id,
        assignedTechnician: input.assignedTechnicianId ?? null,
        bookingType: input.bookingType,
        scheduledFor: input.scheduledFor ?? null,
        paymentMethod: input.paymentMethod,
        promoCode: input.promoCode,
        price: priceRow?.price ?? 0,
        createdBy: user.id,
      })
      .returning();

    return c.json({ data: order }, 201);
  })

  .post('/:id/transition', zValidator('json', washOrderTransitionSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const { status: next, bayId, qcResult } = c.req.valid('json');

    const [order] = await platformDb
      .select()
      .from(washOrders)
      .where(and(eq(washOrders.tenant, tenant.id), eq(washOrders._id, c.req.param('id'))))
      .limit(1);
    if (!order) return c.json({ error: { code: 'not_found', message: 'Order not found' } }, 404);

    const allowed = WASH_ORDER_TRANSITIONS[order.status as WashOrderStatus] ?? [];
    if (!allowed.includes(next)) {
      return c.json(
        {
          error: {
            code: 'invalid_transition',
            message: `Cannot move from ${order.status} to ${next}`,
            details: { allowed },
          },
        },
        422
      );
    }

    if (bayId) {
      const [bay] = await platformDb
        .select()
        .from(serviceBays)
        .where(and(eq(serviceBays.tenant, tenant.id), eq(serviceBays._id, bayId)))
        .limit(1);
      if (!bay) return c.json({ error: { code: 'not_found', message: 'Bay not found' } }, 404);
    }

    const now = new Date();
    const patch: Partial<typeof washOrders.$inferInsert> = { status: next, updatedAt: now };
    if (next === 'bay-assigned') {
      patch.bayAssignedAt = now;
      if (bayId) patch.bay = bayId;
    }
    if (next === 'in-wash') patch.washStartedAt = now;
    if (next === 'quality-check') patch.washCompletedAt = now;
    if (qcResult) patch.qcResult = qcResult;
    if (next === 'completed') patch.checkedOutAt = now;

    const [updated] = await platformDb
      .update(washOrders)
      .set(patch)
      .where(and(eq(washOrders.tenant, tenant.id), eq(washOrders._id, order._id)))
      .returning();

    return c.json({ data: updated });
  })

  .post('/:id/checkout', requireRole('staff'), async (c) => {
    const tenant = c.get('tenant')!;
    const [updated] = await platformDb
      .update(washOrders)
      .set({ status: 'completed', checkedOutAt: new Date(), updatedAt: new Date() })
      .where(and(eq(washOrders.tenant, tenant.id), eq(washOrders._id, c.req.param('id'))))
      .returning();
    if (!updated) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);

    // Roll up customer stats when the order is linked to a customer.
    if (updated.customer) {
      const [cust] = await platformDb
        .select()
        .from(customers)
        .where(and(eq(customers.tenant, tenant.id), eq(customers._id, updated.customer)))
        .limit(1);
      if (cust) {
        await platformDb
          .update(customers)
          .set({
            totalSpent: cust.totalSpent + updated.price,
            visitCount: cust.visitCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(customers._id, cust._id));
      }
    }
    return c.json({ data: updated });
  });
export default router;
