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

// --- Support/CRM (carwash-compile/04-growth/crm.md, data-model.md's Ticket entity). No
// formal sales pipeline is built (the spec itself says to skip it for a walk-in-service
// business) — just the support half, which "applies fully".
//
// State machine (terminal: closed): open -> in-progress (assigned-to-staff) -> resolved
// (issue-resolved) -> closed (closed-after-grace-period); in-progress <-> waiting-on-customer
// (awaiting-customer-response / customer-responded); waiting-on-customer -> closed
// (no-response-14-days). SLA deadlines (server/src/utils/tickets.js) are calendar-time, not
// the spec's "during operating hours" business-hours-aware version — a documented
// simplification; there's no scheduler yet (see automations.js) to proactively alert before
// a breach, so risk is computed on every read instead of pushed ahead of time.
const tickets = pgTable('tickets', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  washOrder: uuid('wash_order_id').references(() => washOrders._id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  // category: damage-claim | billing-dispute | quality-complaint | membership-question | general
  category: text('category').notNull().default('general'),
  priority: text('priority').notNull().default('normal'), // low | normal | high | urgent
  status: text('status').notNull().default('open'),
  description: text('description'),
  assignedTo: uuid('assigned_to_id').references(() => users._id, { onDelete: 'set null' }),
  // source: whatsapp | phone | google-business-profile | in-app — supportChannels in crm.md
  source: text('source').notNull().default('in-app'),
  firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Internal staff-facing update thread on a ticket. The actual customer-facing conversation
// for a WhatsApp-originated ticket lives in agent_conversations / the real WhatsApp thread —
// this is staff notes and status-change log, not a unified omni-channel thread (documented
// gap, see README).
const ticketComments = pgTable('ticket_comments', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  ticket: uuid('ticket_id')
    .notNull()
    .references(() => tickets._id, { onDelete: 'cascade' }),
  author: uuid('author_id').references(() => users._id, { onDelete: 'set null' }),
  // authorType: staff | system — system for auto-logged state changes (e.g. "escalated by wash-concierge")
  authorType: text('author_type').notNull().default('staff'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Finance & accounting ledger (carwash-compile/05-finance/accounting.md). "A native
// ledger, sized for a single-location business (21 accounts) but real double-entry
// throughout - every dollar in the P&L traces to a JournalEntry referencing the WashOrder,
// MembershipSubscription, or [Expense] that generated it." Scoped to the spec's own
// auto-posting triggers that this app actually has a workflow for: WashOrder checkout and a
// successful membership charge, plus this app's pre-existing Expense entity (not in the
// spec, but the natural expense side of the same ledger). Payroll (below) also posts here
// now. Not built, documented at each call site: PurchaseOrder receiving (needs an inventory
// module, not built) and refunds (this app's cancel-wash-order flow only allows cancelling
// before payment is ever collected, so there is no charge to reverse).
//
// Accounts are keyed by the spec's own numeric code (a stable natural key, not a surrogate
// uuid) since the chart of accounts is a small, seeded, effectively-static reference table.
const ledgerAccounts = pgTable('ledger_accounts', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  // type: asset | liability | equity | revenue | expense
  type: text('type').notNull(),
  active: boolean('active').notNull().default(true),
});

// One JournalEntry per real-world transaction; its JournalLines must balance (sum(debit) ===
// sum(credit)) — enforced in ledgerService.postEntry, the only way entries get created.
// sourceEntity/sourceId link back to whatever business event generated it (the spec's own
// "every JournalEntry carries sourceEntity/sourceId back to the transaction that created
// it"), but isn't a DB foreign key — the three source tables don't share a namespace.
const journalEntries = pgTable('journal_entries', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  memo: text('memo').notNull(),
  // sourceEntity: wash_order | membership_subscription | expense | payroll_run
  sourceEntity: text('source_entity').notNull(),
  sourceId: uuid('source_id'),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
});

const journalLines = pgTable('journal_lines', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  entry: uuid('entry_id')
    .notNull()
    .references(() => journalEntries._id, { onDelete: 'cascade' }),
  account: text('account_code')
    .notNull()
    .references(() => ledgerAccounts.code, { onDelete: 'restrict' }),
  debit: doublePrecision('debit').notNull().default(0),
  credit: doublePrecision('credit').notNull().default(0),
});

// --- HR & payroll (carwash-compile/03-operations/hr.md). "A real staff roster for a 6-bay
// site: bay-attendants, wash-technicians, detail-technicians, cashiers, a site-manager, and
// a part-time fleet-account-manager." Employee is explicitly distinct from the login/RBAC
// `role` on `users` (see the spec's own note); `employees.user` links the two but is
// nullable — an Employee record can exist (e.g. an Applicant not yet given a login) without
// a `users` row, and vice versa (an admin login with no HR record).
const employees = pgTable('employees', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  user: uuid('user_id').references(() => users._id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  // position: bay-attendant | wash-technician | detail-technician | cashier | site-manager |
  // fleet-account-manager — the spec's own compensation table keys off this.
  position: text('position').notNull(),
  // status: applicant | hired | onboarding | active | on-leave | offboarded (the spec's
  // own Employee lifecycle).
  status: text('status').notNull().default('active'),
  hireDate: timestamp('hire_date', { withTimezone: true }),
  // Exactly one of hourlyRate/annualSalary is set, matching the spec's compensation table:
  // bay-attendant/wash-technician/cashier/fleet-account-manager are hourly, site-manager is
  // salaried. commissionRate is detail-technician only (10% of PackagePricing.price on
  // completed detail-bay WashOrders, per the spec's own commission basis).
  hourlyRate: doublePrecision('hourly_rate'),
  annualSalary: doublePrecision('annual_salary'),
  commissionRate: doublePrecision('commission_rate'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// schedulingEntity: Shift (employeeId x time window x optional bayId), per the spec.
// checkedInAt/checkedOutAt are this app's own addition — the spec's shift-no-show-alert
// automation needs *something* to detect a no-show against, and this app has no clock-in
// hardware/kiosk, so a staff member (or the employee via a future self-service view, not
// built) marks it here instead.
const shifts = pgTable('shifts', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  employee: uuid('employee_id')
    .notNull()
    .references(() => employees._id, { onDelete: 'cascade' }),
  bay: uuid('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  // status: scheduled | completed | no-show | cancelled
  status: text('status').notNull().default('scheduled'),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Leave management: "request -> site-manager approval -> calendar block ... so Shift
// scheduling automatically respects it". The google-calendar half of that isn't built (no
// such integration exists in this app); instead shiftController blocks creating a new Shift
// that overlaps an *approved* leave request directly against this table — same end result
// for this app's own UI, without a real calendar. The spec's 10-PTO-days/year monthly
// accrual math isn't computed here either (documented, not silently assumed) — this is a
// request/approve workflow only.
const leaveRequests = pgTable('leave_requests', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  employee: uuid('employee_id')
    .notNull()
    .references(() => employees._id, { onDelete: 'cascade' }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  reason: text('reason'),
  // status: pending | approved | denied
  status: text('status').notNull().default('pending'),
  approvedBy: uuid('approved_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Payroll (05-finance/accounting.md's payrollLinked: true / this file's own pipeline:
// "sum Shift hours + detail-technician commission ... -> post to 5000 Payroll Expense ->
// disburse via Stripe -> generate pay-stub documents"). A PayrollRun is computed and posted
// to the ledger in one shot (payrollService.js) — no draft/review step, and immutable once
// created, the same posture as a JournalEntry. Not built: real Stripe disbursement (this
// only posts the accounting entry, it never moves real money) and pay-stub document
// generation (needs 06-platform/knowledge-base.md's document store, not built).
const payrollRuns = pgTable('payroll_runs', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

const payrollLines = pgTable('payroll_lines', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  payrollRun: uuid('payroll_run_id')
    .notNull()
    .references(() => payrollRuns._id, { onDelete: 'cascade' }),
  employee: uuid('employee_id')
    .notNull()
    .references(() => employees._id, { onDelete: 'restrict' }),
  hoursWorked: doublePrecision('hours_worked').notNull().default(0),
  hourlyRate: doublePrecision('hourly_rate'),
  wageAmount: doublePrecision('wage_amount').notNull().default(0),
  commissionAmount: doublePrecision('commission_amount').notNull().default(0),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
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
  tickets,
  ticketComments,
  ledgerAccounts,
  journalEntries,
  journalLines,
  employees,
  shifts,
  leaveRequests,
  payrollRuns,
  payrollLines,
};
