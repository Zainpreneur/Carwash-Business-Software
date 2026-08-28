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
  // gates transactional WhatsApp messaging (carwash-compile/01-foundation/data-model.md);
  // used by the notify-ready-for-pickup automation.
  whatsappOptIn: boolean('whatsapp_opt_in').notNull().default(true),
  // set once a Stripe Customer exists for this customer (membership billing only —
  // never created for a plain pay-per-wash visit).
  stripeCustomerId: text('stripe_customer_id'),
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

// Outbound customer message log (03-operations/automations.md). Sends for real through the
// WhatsApp Cloud API when WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID are configured (see
// utils/whatsapp.js) — status records the outcome (sent/failed); stays 'not_configured'
// otherwise. Either way, this is the audit trail: which automation decided to message a
// customer, with what template, and what happened.
const customerMessages = pgTable('customer_messages', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  washOrder: uuid('wash_order_id').references(() => washOrders._id, { onDelete: 'set null' }),
  channel: text('channel').notNull().default('whatsapp'),
  template: text('template').notNull(),
  automation: text('automation').notNull(),
  status: text('status').notNull().default('queued'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Membership billing (carwash-compile/01-foundation/data-model.md "Membership" +
// 06-platform/integrations.md Stripe entry). Bills for real through Stripe Checkout +
// subscriptions when STRIPE_SECRET_KEY is configured (see config/stripe.js); degrades to a
// locally-tracked "active" subscription with no real billing when it isn't, so the feature
// is demoable without live keys. The spec lists Stripe's auth as oauth2 (Stripe Connect,
// for a platform onboarding many merchant sub-accounts) — this is a single-location
// business integrating its own account directly, so a secret-key integration is the
// correct simplification, not Connect.

const membershipPlans = pgTable('membership_plans', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  // tier: basic-unlimited | premium-unlimited | fleet-unlimited
  tier: text('tier').notNull(),
  name: text('name').notNull(),
  coveredPackage: uuid('covered_package_id')
    .notNull()
    .references(() => washPackages._id, { onDelete: 'restrict' }),
  monthlyPrice: doublePrecision('monthly_price').notNull(),
  isUnlimited: boolean('is_unlimited').notNull().default(true),
  washesPerMonthCap: integer('washes_per_month_cap'),
  rolloverAllowed: boolean('rollover_allowed').notNull().default(false),
  // set once this plan has been synced to Stripe as a Product+Price (see membershipController).
  stripePriceId: text('stripe_price_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// State machine (terminal: cancelled): active -> past-due (billing-charge-failed) ->
// suspended (7 days unresolved) -> cancelled (30 days unresolved) | active (paid manually);
// active <-> paused (customer-requested); active -> cancelled (customer-cancelled).
const membershipSubscriptions = pgTable('membership_subscriptions', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  // plate-linked, one active-at-a-time — enforced in membershipController, not a DB
  // constraint (a vehicle may have a past cancelled subscription on record).
  vehicle: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles._id, { onDelete: 'cascade' }),
  plan: uuid('plan_id')
    .notNull()
    .references(() => membershipPlans._id, { onDelete: 'restrict' }),
  billingDayOfMonth: integer('billing_day_of_month').notNull(),
  nextBillingDate: timestamp('next_billing_date', { withTimezone: true }),
  pausedUntil: timestamp('paused_until', { withTimezone: true }),
  washesThisCycle: integer('washes_this_cycle').notNull().default(0),
  failedPaymentAttempts: integer('failed_payment_attempts').notNull().default(0),
  status: text('status').notNull().default('active'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// wash-concierge's per-customer conversation memory (02-intelligence/ai-agents.md: "per-
// customer conversation history retained 90 days, so a repeat question isn't answered from
// scratch"). Keyed by phone rather than requiring a matched Customer row — an inbound
// WhatsApp message may come from a number not yet on file.
const agentConversations = pgTable('agent_conversations', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  customer: uuid('customer_id').references(() => customers._id, { onDelete: 'set null' }),
  // role: user | assistant
  role: text('role').notNull(),
  content: text('content').notNull(),
  // which tool(s) this turn invoked, if any — audit trail for what the agent actually did.
  toolCalls: jsonb('tool_calls'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
  customerMessages,
  membershipPlans,
  membershipSubscriptions,
  agentConversations,
};
