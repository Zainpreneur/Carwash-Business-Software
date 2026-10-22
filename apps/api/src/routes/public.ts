import {
  bookingServices,
  bookings,
  customers,
  services,
  tenants,
  vehicles,
} from '@carwash/db/schema';
import { publicBookingSchema } from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { platformDb } from '../lib/db.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()

  /** Public tenant branding (used by the booking page before login). */
  .get('/tenants/:slug', async (c) => {
    const [tenant] = await platformDb
      .select({
        id: tenants._id,
        name: tenants.name,
        slug: tenants.slug,
        logoUrl: tenants.logoUrl,
        brandColor: tenants.brandColor,
        currency: tenants.currency,
        phone: tenants.phone,
        address: tenants.address,
        status: tenants.status,
      })
      .from(tenants)
      .where(eq(tenants.slug, c.req.param('slug').toLowerCase()))
      .limit(1);
    if (!tenant || tenant.status === 'closed' || tenant.status === 'suspended') {
      return c.json({ error: { code: 'not_found', message: 'Business not found' } }, 404);
    }
    return c.json({ data: tenant });
  })

  /** Public service catalogue for a tenant. */
  .get('/tenants/:slug/services', async (c) => {
    const [tenant] = await platformDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, c.req.param('slug').toLowerCase()))
      .limit(1);
    if (!tenant)
      return c.json({ error: { code: 'not_found', message: 'Business not found' } }, 404);
    const rows = await platformDb
      .select()
      .from(services)
      .where(and(eq(services.tenant, tenant._id), eq(services.active, true)));
    return c.json({ data: rows });
  })

  /** Public self-service booking. */
  .post('/bookings', zValidator('json', publicBookingSchema), async (c) => {
    const input = c.req.valid('json');
    const [tenant] = await platformDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, input.tenantSlug.toLowerCase()))
      .limit(1);
    if (!tenant || tenant.status === 'closed' || tenant.status === 'suspended') {
      return c.json({ error: { code: 'not_found', message: 'Business not found' } }, 404);
    }

    // Find or create the customer by phone.
    let [customer] = await platformDb
      .select()
      .from(customers)
      .where(and(eq(customers.tenant, tenant._id), eq(customers.phone, input.customer.phone)))
      .limit(1);
    if (!customer) {
      [customer] = await platformDb
        .insert(customers)
        .values({
          tenant: tenant._id,
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
        })
        .returning();
    }

    // Find or create the vehicle by plate.
    let [vehicle] = await platformDb
      .select()
      .from(vehicles)
      .where(
        and(eq(vehicles.tenant, tenant._id), eq(vehicles.plateNumber, input.vehicle.plateNumber))
      )
      .limit(1);
    if (!vehicle) {
      [vehicle] = await platformDb
        .insert(vehicles)
        .values({
          tenant: tenant._id,
          customer: customer!._id,
          make: input.vehicle.make,
          model: input.vehicle.model,
          plateNumber: input.vehicle.plateNumber,
          type: input.vehicle.type,
        })
        .returning();
    }

    // Resolve selected services.
    const selected = await platformDb
      .select()
      .from(services)
      .where(eq(services.tenant, tenant._id));
    const chosen = selected.filter((s) => input.serviceIds.includes(s._id) && s.active);
    if (!chosen.length) {
      return c.json(
        { error: { code: 'invalid_services', message: 'No valid services selected' } },
        400
      );
    }

    const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
    const tax = Math.round(subtotal * Number(tenant.taxRate) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const all = await platformDb
      .select({ _id: bookings._id })
      .from(bookings)
      .where(eq(bookings.tenant, tenant._id));

    const [booking] = await platformDb
      .insert(bookings)
      .values({
        tenant: tenant._id,
        location: input.locationId ?? null,
        bookingNumber: `BK-${String(all.length + 1).padStart(5, '0')}`,
        customer: customer!._id,
        vehicle: vehicle!._id,
        scheduledAt: input.scheduledAt,
        subtotal,
        tax,
        total,
        notes: input.notes,
        status: 'pending',
      })
      .returning();

    if (booking) {
      await platformDb.insert(bookingServices).values(
        chosen.map((s, i) => ({
          tenant: tenant._id,
          booking: booking._id,
          service: s._id,
          name: s.name,
          price: s.price,
          position: i,
        }))
      );
    }

    return c.json(
      {
        data: {
          bookingNumber: booking?.bookingNumber,
          scheduledAt: booking?.scheduledAt,
          total: booking?.total,
          status: booking?.status,
        },
      },
      201
    );
  });
export default router;
