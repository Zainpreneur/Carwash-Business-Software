const {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
} = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('staff'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  avatarColor: text('avatar_color').notNull().default('#2563eb'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const customers = pgTable('customers', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  address: text('address'),
  notes: text('notes'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  totalSpent: doublePrecision('total_spent').notNull().default(0),
  visitCount: integer('visit_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const vehicles = pgTable('vehicles', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year'),
  color: text('color'),
  plateNumber: text('plate_number').notNull(),
  type: text('type').notNull().default('sedan'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const services = pgTable('services', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('basic'),
  price: doublePrecision('price').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  vehicleTypePricing: jsonb('vehicle_type_pricing'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const bookings = pgTable('bookings', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  bookingNumber: text('booking_number').notNull().unique(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  vehicle: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles._id, { onDelete: 'cascade' }),
  assignedStaff: uuid('assigned_staff_id').references(() => users._id, { onDelete: 'set null' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('normal'),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discount: doublePrecision('discount').notNull().default(0),
  tax: doublePrecision('tax').notNull().default(0),
  total: doublePrecision('total').notNull().default(0),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  paymentMethod: text('payment_method').notNull().default('cash'),
  notes: text('notes'),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const bookingServices = pgTable('booking_services', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  booking: uuid('booking_id')
    .notNull()
    .references(() => bookings._id, { onDelete: 'cascade' }),
  service: uuid('service_id').references(() => services._id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull(),
  position: integer('position').notNull().default(0),
});

const expenses = pgTable('expenses', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: doublePrecision('amount').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const notifications = pgTable('notifications', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  user: uuid('user_id')
    .notNull()
    .references(() => users._id, { onDelete: 'cascade' }),
  booking: uuid('booking_id').references(() => bookings._id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- SplashPoint wash-floor module (compiled spec, Phase 1: WashOrder/Vehicle/Customer/
// ServiceBay primary lifecycle only — see carwash-compile/01-foundation/data-model.md).
// Statuses/enums are lower-kebab-case to match this app's existing convention; they map
// 1:1 to the spec's PascalCase state names (e.g. "bay-assigned" = BayAssigned).

const washPackages = pgTable('wash_packages', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  // tier: express-exterior | exterior-plus | signature-full-service | premium-hand-detail
  tier: text('tier').notNull(),
  name: text('name').notNull(),
  // deliveryLane: tunnel | detail-bay — which lane type this package runs in
  deliveryLane: text('delivery_lane').notNull().default('tunnel'),
  includesInterior: boolean('includes_interior').notNull().default(false),
  avgCycleTimeMinutes: integer('avg_cycle_time_minutes').notNull().default(15),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// PackagePricing join entity: a package's price varies by 3-tier vehicle size
// (sedan-coupe | suv-truck | van-oversized — motorcycles/oversized rigs are quoted
// manually per the spec's assumptions, so they have no row here).
const packagePricing = pgTable('package_pricing', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  package: uuid('package_id')
    .notNull()
    .references(() => washPackages._id, { onDelete: 'cascade' }),
  vehicleType: text('vehicle_type').notNull(),
  price: doublePrecision('price').notNull(),
});

const serviceBays = pgTable('service_bays', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  bayNumber: integer('bay_number').notNull().unique(),
  // bayType: tunnel-conveyor | detail-bay
  bayType: text('bay_type').notNull().default('tunnel-conveyor'),
  // operationalStatus: operational | degraded | down | retired
  operationalStatus: text('operational_status').notNull().default('operational'),
  avgThroughputPerHour: doublePrecision('avg_throughput_per_hour'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// WashOrder: the primary lifecycle entity — a vehicle's trip through the wash.
// State machine (terminal: completed, cancelled):
//   queued -> bay-assigned -> in-wash -> quality-check -> ready-for-pickup -> completed
//   quality-check -> in-wash (qc failed, rework)
//   queued | bay-assigned -> cancelled
const washOrders = pgTable('wash_orders', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull().unique(),
  // nullable — anonymous walk-in cash wash is allowed per the spec
  customer: uuid('customer_id').references(() => customers._id, { onDelete: 'set null' }),
  vehicle: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles._id, { onDelete: 'cascade' }),
  package: uuid('package_id')
    .notNull()
    .references(() => washPackages._id, { onDelete: 'restrict' }),
  bay: uuid('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
  assignedTechnician: uuid('assigned_technician_id').references(() => users._id, { onDelete: 'set null' }),
  // bookingType: walk-in | appointment
  bookingType: text('booking_type').notNull().default('walk-in'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  queuePosition: integer('queue_position'),
  queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
  bayAssignedAt: timestamp('bay_assigned_at', { withTimezone: true }),
  washStartedAt: timestamp('wash_started_at', { withTimezone: true }),
  washCompletedAt: timestamp('wash_completed_at', { withTimezone: true }),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
  status: text('status').notNull().default('queued'),
  // qcResult: pass | fail — set by a human technician only
  qcResult: text('qc_result'),
  price: doublePrecision('price').notNull(),
  // paymentMethod: membership | card | cash | fleet-invoice
  paymentMethod: text('payment_method').notNull().default('cash'),
  promoCode: text('promo_code'),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

module.exports = {
  users,
  customers,
  vehicles,
  services,
  bookings,
  bookingServices,
  expenses,
  notifications,
  washPackages,
  packagePricing,
  serviceBays,
  washOrders,
};
