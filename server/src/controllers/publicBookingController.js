const asyncHandler = require('express-async-handler');
const { and, eq, gte, lte, sql } = require('drizzle-orm');
const { db } = require('../config/db');
const {
  tenants,
  services,
  customers,
  vehicles,
  bookings,
  bookingServices,
  serviceBays,
  washPackages,
} = require('../db/schema');
const { runWithTenant } = require('../db/tenantDb');

/**
 * Public booking endpoints — no authentication required.
 */

const resolveTenantBySlug = async (slug) => {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, String(slug).toLowerCase()));
  if (!tenant || tenant.status === 'suspended') return null;
  return tenant;
};

const getBusinessInfo = asyncHandler(async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const tenantId = tenant._id;
  const bays = await runWithTenant(tenantId, async () => {
    return db.select().from(serviceBays);
  });

  res.json({
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.logoUrl,
    brandColor: tenant.brandColor,
    currency: tenant.currency,
    timezone: tenant.timezone,
    phone: tenant.phone,
    address: tenant.address,
    branchCount: bays.length > 0 ? 1 : 0,
  });
});

const getPublicServices = asyncHandler(async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const tenantId = tenant._id;
  const [svcs, pkgs] = await runWithTenant(tenantId, async () => {
    const s = await db.select().from(services).where(eq(services.active, true));
    const p = await db.select().from(washPackages).where(eq(washPackages.active, true));
    return [s, p];
  });

  res.json({
    services: svcs.map((s) => ({
      _id: s._id,
      name: s.name,
      description: s.description,
      category: s.category,
      price: s.price,
      durationMinutes: s.durationMinutes,
    })),
    packages: pkgs.map((p) => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      durationMinutes: p.durationMinutes,
      pricing: p.pricing || p.priceTiers || {},
    })),
  });
});

// GET /api/public/:slug/availability — available time slots for a date
// Shows both empty (available) and filled (booked) slots so customers can see
// the full schedule and pick a free time.
const getAvailability = asyncHandler(async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('date query param is required (YYYY-MM-DD)');
  }

  const tenantId = tenant._id;
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const existing = await runWithTenant(tenantId, async () => {
    return db
      .select()
      .from(bookings)
      .where(
        and(
          gte(bookings.scheduledAt, dayStart),
          lte(bookings.scheduledAt, dayEnd),
          sql`${bookings.status} NOT IN ('cancelled')`
        )
      );
  });

  // Build 30-min slots from 8am to 6pm
  const slots = [];
  const occupied = new Map();
  existing.forEach((b) => {
    const key = new Date(b.scheduledAt).toISOString().slice(0, 16);
    occupied.set(key, b.status);
  });

  for (let h = 8; h < 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slot = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const key = slot.toISOString().slice(0, 16);
      const status = occupied.get(key);
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        available: !status,
        status: status || null, // 'pending' | 'confirmed' | 'in-progress' | etc. or null
        datetime: slot.toISOString(),
      });
    }
  }

  // Summary counts
  const totalSlots = slots.length;
  const availableCount = slots.filter((s) => s.available).length;
  const bookedCount = totalSlots - availableCount;

  res.json({
    date,
    slots,
    summary: {
      total: totalSlots,
      available: availableCount,
      booked: bookedCount,
    },
  });
});

const createPublicBooking = asyncHandler(async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const { customerName, customerPhone, customerEmail, vehiclePlate, vehicleMake, vehicleModel, serviceIds, scheduledAt, notes } = req.body;

  if (!customerName || !customerPhone || !scheduledAt) {
    res.status(400);
    throw new Error('Name, phone, and scheduled time are required');
  }

  const tenantId = tenant._id;

  const result = await runWithTenant(tenantId, async () => {
    let [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, customerPhone));
    if (!customer) {
      const [c] = await db
        .insert(customers)
        .values({
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
        })
        .returning();
      customer = c;
    }

    let vehicle = null;
    if (vehiclePlate) {
      const [v] = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.plateNumber, vehiclePlate.toUpperCase()));
      if (!v) {
        const [newV] = await db
          .insert(vehicles)
          .values({
            customer: customer._id,
            plateNumber: vehiclePlate.toUpperCase(),
            make: vehicleMake || 'Unknown',
            model: vehicleModel || 'Unknown',
          })
          .returning();
        vehicle = newV;
      } else {
        vehicle = v;
      }
    } else {
      const [newV] = await db
        .insert(vehicles)
        .values({
          customer: customer._id,
          plateNumber: `WALK-${Date.now().toString(36).toUpperCase()}`,
          make: 'Unknown',
          model: 'Unknown',
        })
        .returning();
      vehicle = newV;
    }

    const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber,
        customer: customer._id,
        vehicle: vehicle._id,
        scheduledAt: new Date(scheduledAt),
        status: 'pending',
        notes: notes || null,
      })
      .returning();

    if (serviceIds && serviceIds.length) {
      for (const sid of serviceIds) {
        const [svc] = await db.select().from(services).where(eq(services._id, sid));
        if (svc) {
          await db.insert(bookingServices).values({
            booking: booking._id,
            service: svc._id,
            name: svc.name,
            price: svc.price,
          });
        }
      }
    }

    return { booking, customer, vehicle };
  });

  res.status(201).json({
    bookingNumber: result.booking.bookingNumber,
    bookingId: result.booking._id,
    status: result.booking.status,
    scheduledAt: result.booking.scheduledAt,
    customer: result.customer.name,
    message: 'Booking created successfully! We will confirm shortly.',
  });
});

const getBookingStatus = asyncHandler(async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404);
    throw new Error('Business not found');
  }

  const tenantId = tenant._id;
  const [booking] = await runWithTenant(tenantId, async () => {
    return db
      .select()
      .from(bookings)
      .where(eq(bookings._id, req.params.id));
  });

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  res.json({
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    scheduledAt: booking.scheduledAt,
    notes: booking.notes,
  });
});

module.exports = {
  getBusinessInfo,
  getPublicServices,
  getAvailability,
  createPublicBooking,
  getBookingStatus,
};
