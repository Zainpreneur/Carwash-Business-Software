import { bookingServices, bookings, services, vehicles } from '@carwash/db/schema';
import {
  createBookingSchema,
  paginationSchema,
  updateBookingSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

async function nextBookingNumber(tenantId: string): Promise<string> {
  const [row] = await platformDb
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.tenant, tenantId));
  return `BK-${String(Number(row?.count ?? 0) + 1).padStart(5, '0')}`;
}

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  .get('/', async (c) => {
    const tenant = c.get('tenant')!;
    const parsed = paginationSchema.safeParse(c.req.query());
    if (!parsed.success)
      return c.json({ error: { code: 'validation_error', message: 'Invalid query' } }, 400);
    const { page, limit } = parsed.data;
    const status = c.req.query('status');

    const conditions = [eq(bookings.tenant, tenant.id)];
    if (status) conditions.push(eq(bookings.status, status));

    const [rows, counted] = await Promise.all([
      platformDb
        .select()
        .from(bookings)
        .where(and(...conditions))
        .orderBy(desc(bookings.scheduledAt))
        .limit(limit)
        .offset((page - 1) * limit),
      platformDb
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(...conditions)),
    ]);
    const total = Number(counted[0]?.count ?? 0);
    return c.json({
      data: rows,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })

  .get('/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [booking] = await platformDb
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenant, tenant.id), eq(bookings._id, c.req.param('id'))))
      .limit(1);
    if (!booking) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    const lines = await platformDb
      .select()
      .from(bookingServices)
      .where(eq(bookingServices.booking, booking._id));
    return c.json({ data: { ...booking, services: lines } });
  })

  .post('/', zValidator('json', createBookingSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const input = c.req.valid('json');
    const user = c.get('user')!;

    const subtotal = input.services.reduce((sum, s) => sum + s.price, 0);
    const taxable = Math.max(0, subtotal - input.discount);
    const tax = Math.round(taxable * tenant.taxRate * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const [booking] = await platformDb
      .insert(bookings)
      .values({
        tenant: tenant.id,
        location: input.locationId ?? tenant.locationId,
        bookingNumber: await nextBookingNumber(tenant.id),
        customer: input.customerId,
        vehicle: input.vehicleId,
        assignedStaff: input.assignedStaffId ?? null,
        scheduledAt: input.scheduledAt,
        priority: input.priority,
        subtotal,
        discount: input.discount,
        tax,
        total,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        createdBy: user.id,
      })
      .returning();

    if (booking) {
      await platformDb.insert(bookingServices).values(
        input.services.map((s, i) => ({
          tenant: tenant.id,
          booking: booking._id,
          service: s.serviceId ?? null,
          name: s.name,
          price: s.price,
          position: i,
        }))
      );
      // Keep the service catalogue's booking count accurate for reporting.
      for (const s of input.services) {
        if (s.serviceId) {
          await platformDb
            .update(services)
            .set({ updatedAt: new Date() })
            .where(and(eq(services.tenant, tenant.id), eq(services._id, s.serviceId)));
        }
      }
    }

    return c.json({ data: booking }, 201);
  })

  .patch('/:id', zValidator('json', updateBookingSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const [updated] = await platformDb
      .update(bookings)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(and(eq(bookings.tenant, tenant.id), eq(bookings._id, c.req.param('id'))))
      .returning();
    if (!updated) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: updated });
  })

  .delete('/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [deleted] = await platformDb
      .delete(bookings)
      .where(and(eq(bookings.tenant, tenant.id), eq(bookings._id, c.req.param('id'))))
      .returning();
    if (!deleted) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ ok: true });
  })

  // Convenience: vehicles for a customer (used by the booking form).
  .get('/meta/vehicles', async (c) => {
    const tenant = c.get('tenant')!;
    const customerId = c.req.query('customerId');
    if (!customerId) return c.json({ data: [] });
    const rows = await platformDb
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.tenant, tenant.id), eq(vehicles.customer, customerId)));
    return c.json({ data: rows });
  });
export default router;
