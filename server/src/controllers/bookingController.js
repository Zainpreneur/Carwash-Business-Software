const asyncHandler = require('express-async-handler');
const { eq, desc, asc, and, gte, lte, inArray, like, sql, count } = require('drizzle-orm');
const { db } = require('../config/db');
const { bookings, bookingServices, services, customers, vehicles, users } = require('../db/schema');
const { notifyRoles } = require('../utils/notify');

const generateBookingNumber = async () => {
  const today = new Date();
  const prefix = `CW${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const [{ total }] = await db
    .select({ total: count() })
    .from(bookings)
    .where(like(bookings.bookingNumber, `${prefix}%`));
  return `${prefix}-${String(Number(total) + 1).padStart(3, '0')}`;
};

const computeTotals = (items, discount = 0, taxRate = 0) => {
  const subtotal = items.reduce((sum, s) => sum + Number(s.price), 0);
  const discounted = Math.max(subtotal - Number(discount || 0), 0);
  const tax = Math.round(discounted * (Number(taxRate) / 100) * 100) / 100;
  const total = Math.round((discounted + tax) * 100) / 100;
  return { subtotal, tax, total };
};

// Attach embedded service items to booking rows
const attachServices = async (bookingRows) => {
  if (!bookingRows.length) return [];
  const items = await db
    .select()
    .from(bookingServices)
    .where(inArray(bookingServices.booking, bookingRows.map((b) => b._id)))
    .orderBy(asc(bookingServices.position));
  const byBooking = new Map();
  for (const item of items) {
    if (!byBooking.has(item.booking)) byBooking.set(item.booking, []);
    byBooking.get(item.booking).push({ _id: item._id, service: item.service, name: item.name, price: item.price });
  }
  return bookingRows.map((b) => ({ ...b, services: byBooking.get(b._id) || [] }));
};

const listSelect = {
  _id: bookings._id,
  bookingNumber: bookings.bookingNumber,
  customer: {
    _id: customers._id,
    name: customers.name,
    phone: customers.phone,
  },
  vehicle: {
    _id: vehicles._id,
    make: vehicles.make,
    model: vehicles.model,
    plateNumber: vehicles.plateNumber,
    type: vehicles.type,
  },
  assignedStaff: {
    _id: users._id,
    name: users.name,
  },
  scheduledAt: bookings.scheduledAt,
  status: bookings.status,
  priority: bookings.priority,
  subtotal: bookings.subtotal,
  discount: bookings.discount,
  tax: bookings.tax,
  total: bookings.total,
  paymentStatus: bookings.paymentStatus,
  paymentMethod: bookings.paymentMethod,
  notes: bookings.notes,
  createdAt: bookings.createdAt,
};
const staffAlias = users;

const getBookings = asyncHandler(async (req, res) => {
  const { status, date, from, to, customer, staff, page = 1, limit = 20 } = req.query;
  const filters = [];
  if (status) filters.push(eq(bookings.status, status));
  if (customer) filters.push(eq(bookings.customer, customer));
  if (staff) filters.push(eq(bookings.assignedStaff, staff));
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filters.push(and(gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end)));
  } else {
    if (from) filters.push(gte(bookings.scheduledAt, new Date(from)));
    if (to) filters.push(lte(bookings.scheduledAt, new Date(to)));
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select(listSelect)
    .from(bookings)
    .innerJoin(customers, eq(bookings.customer, customers._id))
    .innerJoin(vehicles, eq(bookings.vehicle, vehicles._id))
    .leftJoin(staffAlias, eq(bookings.assignedStaff, staffAlias._id))
    .where(where)
    .orderBy(desc(bookings.scheduledAt))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));

  const itemsByBooking = new Map();
  if (rows.length) {
    const items = await db
      .select()
      .from(bookingServices)
      .where(inArray(bookingServices.booking, rows.map((r) => r._id)))
      .orderBy(asc(bookingServices.position));
    for (const item of items) {
      if (!itemsByBooking.has(item.booking)) itemsByBooking.set(item.booking, []);
      itemsByBooking.get(item.booking).push({ service: item.service, name: item.name, price: item.price });
    }
  }
  const data = rows.map((r) => ({ ...r, services: itemsByBooking.get(r._id) || [] }));

  const [{ total }] = await db.select({ total: count() }).from(bookings).where(where);
  res.json({ data, total: Number(total), page: Number(page), pages: Math.ceil(Number(total) / Number(limit)) });
});

const getBookingById = asyncHandler(async (req, res) => {
  const [row] = await db
    .select({
      ...listSelect,
      customerFull: customers,
      vehicleFull: vehicles,
      staffEmail: users.email,
      staffPhone: users.phone,
      createdBy: bookings.createdBy,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customer, customers._id))
    .innerJoin(vehicles, eq(bookings.vehicle, vehicles._id))
    .leftJoin(users, eq(bookings.assignedStaff, users._id))
    .where(eq(bookings._id, req.params.id));

  if (!row) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const [withItems] = await attachServices([{ ...row, customer: row.customer._id, vehicle: row.vehicle._id }]);
  const [creator] = row.createdBy
    ? await db.select({ _id: users._id, name: users.name }).from(users).where(eq(users._id, row.createdBy))
    : [];

  res.json({
    ...withItems,
    customer: row.customerFull,
    vehicle: row.vehicleFull,
    assignedStaff: row.assignedStaff
      ? { _id: row.assignedStaff._id, name: row.assignedStaff.name, email: row.staffEmail, phone: row.staffPhone }
      : null,
    createdBy: creator || null,
  });
});

const createBooking = asyncHandler(async (req, res) => {
  const { customer, vehicle, serviceIds, assignedStaff, scheduledAt, discount, taxRate, notes, priority } =
    req.body;

  if (!serviceIds || !serviceIds.length) {
    res.status(400);
    throw new Error('At least one service must be selected');
  }

  const selected = await db.select().from(services).where(inArray(services._id, serviceIds));
  if (!selected.length) {
    res.status(400);
    throw new Error('Selected services not found');
  }
  // Preserve client-supplied order
  const ordered = serviceIds.map((id) => selected.find((s) => s._id === id)).filter(Boolean);
  const items = ordered.map((s) => ({ service: s._id, name: s.name, price: s.price }));
  const { subtotal, tax, total } = computeTotals(items, discount, taxRate);

  const bookingNumber = await generateBookingNumber();

  const [booking] = await db
    .insert(bookings)
    .values({
      bookingNumber,
      customer,
      vehicle,
      assignedStaff: assignedStaff || null,
      scheduledAt: new Date(scheduledAt),
      discount: discount || 0,
      tax,
      subtotal,
      total,
      notes,
      priority,
      createdBy: req.user._id,
    })
    .returning();

  await db.insert(bookingServices).values(
    items.map((item, i) => ({
      booking: booking._id,
      service: item.service,
      name: item.name,
      price: item.price,
      position: i,
    }))
  );

  req.params.id = booking._id;

  notifyRoles(
    ['admin', 'manager', 'staff'],
    {
      type: 'booking_created',
      title: 'New booking',
      message: `Booking ${bookingNumber} created for ${scheduledAt ? new Date(scheduledAt).toLocaleString() : 'unscheduled time'}`,
      booking: booking._id,
    },
    req.user._id
  ).catch(() => {});

  return getBookingById(req, res);
});

const updateBooking = asyncHandler(async (req, res) => {
  const [booking] = await db.select().from(bookings).where(eq(bookings._id, req.params.id));
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const { serviceIds, discount, taxRate, assignedStaff, scheduledAt, notes, priority, paymentMethod } =
    req.body;

  let currentItems;
  if (serviceIds && serviceIds.length) {
    const selected = await db.select().from(services).where(inArray(services._id, serviceIds));
    const ordered = serviceIds.map((id) => selected.find((s) => s._id === id)).filter(Boolean);
    currentItems = ordered.map((s) => ({ service: s._id, name: s.name, price: s.price }));
  } else {
    const existing = await db.select().from(bookingServices).where(eq(bookingServices.booking, booking._id));
    currentItems = existing.map((s) => ({ service: s.service, name: s.name, price: s.price }));
  }

  const { subtotal, tax, total } = computeTotals(
    currentItems,
    discount !== undefined ? discount : booking.discount,
    taxRate !== undefined ? taxRate : 0
  );

  const updates = { subtotal, tax, total, updatedAt: new Date() };
  if (discount !== undefined) updates.discount = discount;
  if (assignedStaff !== undefined) updates.assignedStaff = assignedStaff || null;
  if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt);
  if (notes !== undefined) updates.notes = notes;
  if (priority !== undefined) updates.priority = priority;
  if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;

  await db.update(bookings).set(updates).where(eq(bookings._id, booking._id));

  if (serviceIds && serviceIds.length) {
    await db.delete(bookingServices).where(eq(bookingServices.booking, booking._id));
    await db.insert(bookingServices).values(
      currentItems.map((item, i) => ({
        booking: booking._id,
        service: item.service,
        name: item.name,
        price: item.price,
        position: i,
      }))
    );
  }

  return getBookingById(req, res);
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Invalid status value');
  }

  const [booking] = await db.select().from(bookings).where(eq(bookings._id, req.params.id));
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const wasCompleted = booking.status === 'completed';
  await db
    .update(bookings)
    .set({ status, updatedAt: new Date() })
    .where(eq(bookings._id, booking._id));

  if (status === 'completed' && !wasCompleted) {
    await db
      .update(customers)
      .set({
        totalSpent: sql`${customers.totalSpent} + ${booking.total}`,
        visitCount: sql`${customers.visitCount} + 1`,
        loyaltyPoints: sql`${customers.loyaltyPoints} + ${Math.floor(booking.total / 10)}`,
        updatedAt: new Date(),
      })
      .where(eq(customers._id, booking.customer));
  }

  notifyRoles(
    ['admin', 'manager', 'staff'],
    {
      type: status === 'completed' ? 'booking_completed' : 'booking_status',
      title:
        status === 'completed'
          ? `Booking ${booking.bookingNumber} completed`
          : `Booking ${booking.bookingNumber}: ${status}`,
      message:
        status === 'completed'
          ? `${booking.bookingNumber} completed — total $${Number(booking.total).toFixed(2)}. Loyalty points awarded.`
          : `${booking.bookingNumber} moved to "${status}".`,
      booking: booking._id,
    },
    req.user._id
  ).catch(() => {});

  const [updated] = await db.select().from(bookings).where(eq(bookings._id, booking._id));
  res.json(updated);
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;
  const updates = { updatedAt: new Date() };
  if (paymentStatus) updates.paymentStatus = paymentStatus;
  if (paymentMethod) updates.paymentMethod = paymentMethod;

  const [updated] = await db.update(bookings).set(updates).where(eq(bookings._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Booking not found');
  }
  res.json(updated);
});

const deleteBooking = asyncHandler(async (req, res) => {
  const deleted = await db.delete(bookings).where(eq(bookings._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Booking not found');
  }
  res.json({ message: 'Booking removed' });
});

module.exports = {
  getBookings,
  getBooking: getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  updatePaymentStatus,
  deleteBooking,
};
