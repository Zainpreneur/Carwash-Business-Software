import {
  bool,
  index,
  integer,
  json,
  real,
  sqliteTable,
  text,
  timestampMs,
  timestamps,
  uid,
  uniqueIndex,
} from '../columns.js';
import { locations, tenants, users } from './platform.js';

// ---------------------------------------------------------------------------
// Tenant-owned core business data
// ---------------------------------------------------------------------------

/** Per-vehicle-type price overrides, e.g. { sedan: 10, suv: 15 }. */
export type VehicleTypePricing = Record<string, number>;

export const customers = sqliteTable(
  'customers',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone').notNull(),
    address: text('address'),
    notes: text('notes'),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    totalSpent: real('total_spent').notNull().default(0),
    visitCount: integer('visit_count').notNull().default(0),
    active: bool('active').notNull().default(true),
    whatsappOptIn: bool('whatsapp_opt_in').notNull().default(true),
    stripeCustomerId: text('stripe_customer_id'),
    isFleetAccount: bool('is_fleet_account').notNull().default(false),
    referralCode: text('referral_code'),
    referredByCode: text('referred_by_code'),
    ...timestamps,
  },
  (t) => [
    index('idx_customers_tenant').on(t.tenant),
    uniqueIndex('uq_customers_tenant_referral').on(t.tenant, t.referralCode),
  ]
);

export const vehicles = sqliteTable(
  'vehicles',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year'),
    color: text('color'),
    plateNumber: text('plate_number').notNull(),
    type: text('type').notNull().default('sedan'),
    lastWashAt: timestampMs('last_wash_at'),
    ...timestamps,
  },
  (t) => [
    index('idx_vehicles_tenant').on(t.tenant),
    index('idx_vehicles_tenant_plate').on(t.tenant, t.plateNumber),
  ]
);

export const services = sqliteTable(
  'services',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('basic'),
    price: real('price').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    vehicleTypePricing: json<VehicleTypePricing>('vehicle_type_pricing'),
    active: bool('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('idx_services_tenant').on(t.tenant)]
);

export const bookings = sqliteTable(
  'bookings',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    bookingNumber: text('booking_number').notNull(),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
    vehicle: text('vehicle_id')
      .notNull()
      .references(() => vehicles._id, { onDelete: 'cascade' }),
    assignedStaff: text('assigned_staff_id').references(() => users.id, { onDelete: 'set null' }),
    scheduledAt: timestampMs('scheduled_at').notNull(),
    /** status: pending | confirmed | in-progress | completed | cancelled */
    status: text('status').notNull().default('pending'),
    priority: text('priority').notNull().default('normal'),
    subtotal: real('subtotal').notNull().default(0),
    discount: real('discount').notNull().default(0),
    tax: real('tax').notNull().default(0),
    total: real('total').notNull().default(0),
    paymentStatus: text('payment_status').notNull().default('unpaid'),
    paymentMethod: text('payment_method').notNull().default('cash'),
    notes: text('notes'),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('idx_bookings_tenant').on(t.tenant),
    index('idx_bookings_tenant_location').on(t.tenant, t.location),
    index('idx_bookings_tenant_scheduled').on(t.tenant, t.scheduledAt),
    uniqueIndex('uq_bookings_tenant_number').on(t.tenant, t.bookingNumber),
  ]
);

export const bookingServices = sqliteTable(
  'booking_services',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    booking: text('booking_id')
      .notNull()
      .references(() => bookings._id, { onDelete: 'cascade' }),
    service: text('service_id').references(() => services._id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    price: real('price').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('idx_booking_services_tenant').on(t.tenant)]
);

export const expenses = sqliteTable(
  'expenses',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    category: text('category').notNull(),
    description: text('description').notNull(),
    amount: real('amount').notNull(),
    date: timestampMs('date')
      .notNull()
      .$defaultFn(() => new Date()),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('idx_expenses_tenant').on(t.tenant, t.date)]
);

export const notifications = sqliteTable(
  'notifications',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    booking: text('booking_id').references(() => bookings._id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('info'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    read: bool('read').notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_notifications_tenant_user').on(t.tenant, t.user)]
);
