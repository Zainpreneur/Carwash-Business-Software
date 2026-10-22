import {
  bookings,
  customers,
  membershipSubscriptions,
  supplies,
  tickets,
  washOrders,
} from '@carwash/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  .get('/summary', async (c) => {
    const tenant = c.get('tenant')!;
    const since = startOfToday();

    const [todayOrders] = await platformDb
      .select({
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${washOrders.price}), 0)`,
      })
      .from(washOrders)
      .where(and(eq(washOrders.tenant, tenant.id), gte(washOrders.queuedAt, since)));

    const [activeCustomers] = await platformDb
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(and(eq(customers.tenant, tenant.id), eq(customers.active, true)));

    const [activeMemberships] = await platformDb
      .select({ count: sql<number>`count(*)` })
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.tenant, tenant.id),
          eq(membershipSubscriptions.status, 'active')
        )
      );

    const [openTickets] = await platformDb
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(eq(tickets.tenant, tenant.id), eq(tickets.status, 'open')));

    const [upcomingBookings] = await platformDb
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(eq(bookings.tenant, tenant.id), gte(bookings.scheduledAt, new Date())));

    const lowStock = await platformDb
      .select()
      .from(supplies)
      .where(and(eq(supplies.tenant, tenant.id), eq(supplies.active, true)))
      .limit(100);

    return c.json({
      data: {
        today: {
          orders: Number(todayOrders?.count ?? 0),
          revenue: Number(todayOrders?.revenue ?? 0),
        },
        activeCustomers: Number(activeCustomers?.count ?? 0),
        activeMemberships: Number(activeMemberships?.count ?? 0),
        openTickets: Number(openTickets?.count ?? 0),
        upcomingBookings: Number(upcomingBookings?.count ?? 0),
        lowStock: lowStock
          .filter((s) => s.quantityOnHand <= 10)
          .map((s) => ({
            id: s._id,
            name: s.name,
            quantityOnHand: s.quantityOnHand,
            unit: s.unit,
          })),
      },
    });
  })

  /** Queue length by wash-order status (wash-floor TV/board). */
  .get('/queue', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select({ status: washOrders.status, count: sql<number>`count(*)` })
      .from(washOrders)
      .where(eq(washOrders.tenant, tenant.id))
      .groupBy(washOrders.status);
    return c.json({ data: rows.map((r) => ({ status: r.status, count: Number(r.count) })) });
  })

  /** Recent activity feed. */
  .get('/recent-orders', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(washOrders)
      .where(eq(washOrders.tenant, tenant.id))
      .orderBy(desc(washOrders.queuedAt))
      .limit(10);
    return c.json({ data: rows });
  });
export default router;
