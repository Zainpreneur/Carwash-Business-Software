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
  // fleet-lead-scorer's own segment key (04-growth/marketing.md's "Fleet/Commercial"
  // segment) — set manually by staff, or automatically once a fleet inquiry scores high
  // enough (see fleetInquiries below); no automatic detection from wash volume alone.
  isFleetAccount: boolean('is_fleet_account').notNull().default(false),
  // Referral program (04-growth/marketing.md): every customer gets a stable referralCode
  // once generated; referredByCode records whose code got them in the door, checked once
  // against washOrderController.checkout's first-completed-order crediting logic.
  referralCode: text('referral_code').unique(),
  referredByCode: text('referred_by_code'),
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
  // Set only for paymentMethod=fleet-invoice, once a site-manager confirms the net-15
  // payment actually arrived (02-intelligence/analytics.md's AR Aging report ages this
  // against checkedOutAt while it stays null). Nothing else in this app previously modeled
  // fleet-invoice collection at all — checkout only ever posted the AR debit, never the
  // matching cash-in entry.
  fleetInvoiceCollectedAt: timestamp('fleet_invoice_collected_at', { withTimezone: true }),
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
  // Set the moment a subscription first goes past-due; cleared on any return to active.
  // membershipBillingAgent.js reads this to evaluate the "7 days unresolved" / "30 days
  // unresolved" clauses of the state machine above — this app has no scheduler to walk the
  // calendar and check every subscription proactively, so the clock only advances on each
  // new payment-failed event the real Stripe account sends, not silently in the background.
  firstFailedAt: timestamp('first_failed_at', { withTimezone: true }),
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
// now. So does receiving a PurchaseOrder and posting a stock write-off (inventoryService.js,
// below). Not built: refunds (this app's cancel-wash-order flow only allows cancelling
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
  // sourceEntity: wash_order | membership_subscription | expense | payroll_run |
  // purchase_order | stock_adjustment
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

// --- Inventory & supply chain (carwash-compile/03-operations/inventory.md). "Chemicals,
// tunnel/detail supplies, and disposables - not durable equipment" (that's assets-iot.md's
// domain, not built). Supply and Stock are the spec's own two entities, but this app
// consolidates them into one table: "sku-quantity" tracking with no batch/lot numbers and a
// single location with `stockTransfers: false` means a separate Stock row per Supply item
// buys nothing here that a quantityOnHand column doesn't already give — a documented
// simplification, not a missing feature.
const suppliers = pgTable('suppliers', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
});

const supplies = pgTable('supplies', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // warehouse: main-chemical-room | detail-bay-storage — kept separate per the spec's own
  // reasoning ("a detail-bay stockout doesn't get masked by chemical-room supply").
  warehouse: text('warehouse').notNull().default('main-chemical-room'),
  unit: text('unit').notNull().default('unit'), // e.g. gallon, case, roll
  quantityOnHand: doublePrecision('quantity_on_hand').notNull().default(0),
  unitCost: doublePrecision('unit_cost').notNull().default(0),
  supplier: uuid('supplier_id').references(() => suppliers._id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// "Chemical consumption scales with package mix, not just wash count" — how much of a given
// Supply one wash of a given WashPackage consumes. inventory-forecaster reads trailing
// WashOrder volume grouped by package against this table rather than a single flat
// per-vehicle average.
const packageSupplyUsage = pgTable('package_supply_usage', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  package: uuid('package_id')
    .notNull()
    .references(() => washPackages._id, { onDelete: 'cascade' }),
  supply: uuid('supply_id')
    .notNull()
    .references(() => supplies._id, { onDelete: 'cascade' }),
  quantityPerWash: doublePrecision('quantity_per_wash').notNull(),
});

// State machine: Draft -> Sent -> PartiallyReceived -> Received -> Closed. inventory-
// forecaster's own recommendations create these directly (auto-sent under $150, Draft
// above it pending site-manager approval); receiving updates Stock and posts the A/P
// journal entry (server/src/services/inventoryService.js), matching accounting.payrollLinked's
// same "share one source of truth" principle.
const purchaseOrders = pgTable('purchase_orders', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  supplier: uuid('supplier_id')
    .notNull()
    .references(() => suppliers._id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  // source: inventory-forecaster | manual — who drafted it, for the /inventory UI to show
  // "auto-recommended" vs. staff-created purchase orders distinctly.
  source: text('source').notNull().default('manual'),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by_id').references(() => users._id, { onDelete: 'set null' }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const purchaseOrderLines = pgTable('purchase_order_lines', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  purchaseOrder: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders._id, { onDelete: 'cascade' }),
  supply: uuid('supply_id')
    .notNull()
    .references(() => supplies._id, { onDelete: 'restrict' }),
  quantityOrdered: doublePrecision('quantity_ordered').notNull(),
  quantityReceived: doublePrecision('quantity_received').notNull().default(0),
  unitCost: doublePrecision('unit_cost').notNull(),
});

// StockAdjustment (shrinkage & write-offs) — "always requiring approvedBy ... same approval
// discipline as a discount/refund". approvedBy references an Employee (not a bare users
// row) since the spec explicitly calls out this is an HR-tracked accountability, not just
// whoever's logged in.
const stockAdjustments = pgTable('stock_adjustments', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  supply: uuid('supply_id')
    .notNull()
    .references(() => supplies._id, { onDelete: 'cascade' }),
  // quantityDelta: negative for a loss (breakage/spillage/theft/expired), positive for a
  // count-correction that found more stock than the system expected.
  quantityDelta: doublePrecision('quantity_delta').notNull(),
  // reasonCode: breakage | spillage | theft | expired | count-correction
  reasonCode: text('reason_code').notNull(),
  notes: text('notes'),
  approvedBy: uuid('approved_by_id')
    .notNull()
    .references(() => employees._id, { onDelete: 'restrict' }),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Orchestrator & advisor agents (02-intelligence/ai-agents.md's "Orchestrator" and
// "Advisor agents" sections) — the last two clusters of the 12-agent roster this app
// implements against real entities. `ops-orchestrator` itself makes no Claude call (its own
// job — "routes work to the right specialist... routing only, no independent transactional
// authority" — is deterministic aggregation, the same reasoning that kept
// membership-billing-agent and inventory-forecaster LLM-free); `system-health-agent` needs
// somewhere to read "the AI workforce's own operating data" from, which nothing in this app
// logged before now.
const agentMetrics = pgTable('agent_metrics', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  // agentName: queue-dispatch-agent | wash-concierge | membership-billing-agent |
  // inventory-forecaster | strategy-advisor
  agentName: text('agent_name').notNull(),
  // source: ai-agent | deterministic-fallback (a Claude-capable agent that ran the
  // fallback path) | deterministic (an agent — membership-billing-agent,
  // inventory-forecaster — that never calls Claude at all)
  source: text('source').notNull(),
  // escalated: only meaningful for wash-concierge (whether escalate_to_human fired this turn)
  escalated: boolean('escalated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// strategy-advisor's own "remembers prior recommendations and their stated confidence for
// 12 months, so it flags rather than silently contradicts an earlier stance." This table
// *is* that memory — a real row per question asked, not a conversation transcript (advisor
// questions are one-shot asks, not a back-and-forth chat like wash-concierge's).
const strategyRecommendations = pgTable('strategy_recommendations', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  // pattern: unit-economics | scenario-comparison | root-cause-5-whys | decision-matrix | none
  // ("none" when no Claude key is configured and the fallback message is returned instead).
  pattern: text('pattern').notNull().default('none'),
  confidencePercent: integer('confidence_percent'),
  askedBy: uuid('asked_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Growth cluster (04-growth/marketing.md, 04-growth/social-media.md) — the two task
// agents from the spec's own roster that are buildable against real (if manually-entered)
// data rather than a live ad-platform or Google Business Profile connector this app has no
// credentials for. The rest of the growth cluster (paid ad campaigns, A/B testing, the
// content-calendar/SocialPost publishing pipeline, multi-week lifecycle drip follow-ups —
// all of which genuinely need a scheduler or a real ad/social API this app doesn't have) is
// documented as not built rather than faked.
//
// fleet-lead-scorer: "scores an inbound commercial/fleet inquiry ... creates a follow-up
// notification for fleet-account-manager, rather than running a full sales pipeline" (the
// spec's own reasoning for skipping the pipeline — see 04-growth/crm.md — doesn't apply to
// this lightweight scorer). Makes NO Claude call: scoring from three stated inputs against
// stated thresholds is arithmetic, not a judgment call, the same reasoning that kept
// membership-billing-agent/inventory-forecaster LLM-free.
const fleetInquiries = pgTable('fleet_inquiries', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id').references(() => customers._id, { onDelete: 'set null' }),
  companyName: text('company_name').notNull(),
  contactPhone: text('contact_phone'),
  vehicleCountRequested: integer('vehicle_count_requested').notNull(),
  // contactPattern: business-hours | after-hours — one of the spec's own stated scoring inputs.
  contactPattern: text('contact_pattern').notNull().default('business-hours'),
  invoicingTermsRequested: boolean('invoicing_terms_requested').notNull().default(false),
  score: integer('score').notNull(),
  // status: new | followed-up | converted | declined
  status: text('status').notNull().default('new'),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// review-response-agent: "monitors Google Business Profile and social mentions, auto-thanks
// simple positive reviews with a loyalty-point offer, and opens a Ticket + immediate
// site-manager alert for anything negative or mentioning damage." The monitoring/detection
// half isn't built (no Google Business Profile/social API connector) — reviews are logged
// here manually (by staff, or a future webhook), and the response logic downstream of that
// is real. Also makes NO Claude call: the guardrail itself is a rating threshold plus a
// keyword check, not free-form sentiment judgment — deliberately conservative and
// deterministic rather than trusting an LLM's read of "does this mention damage" for a
// reputational-risk decision this spec calls out as high-stakes.
const reviews = pgTable('reviews', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id').references(() => customers._id, { onDelete: 'set null' }),
  // source: google-business-profile | instagram | facebook | tiktok | manual
  source: text('source').notNull().default('manual'),
  rating: integer('rating').notNull(),
  text: text('text'),
  // status: auto-responded | escalated
  status: text('status').notNull(),
  response: text('response'),
  ticket: uuid('ticket_id').references(() => tickets._id, { onDelete: 'set null' }),
  loggedBy: uuid('logged_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Knowledge Base (06-platform/knowledge-base.md) — closes a gap wash-concierge's own header
// comment has flagged since it was built: the spec names a real `knowledge_base.search` tool
// (02-intelligence/ai-agents.md's tool list for wash-concierge) and says wash-concierge,
// review-response-agent, and phone-line-agent must cite a KB article rather than freely
// inventing a policy answer. Sized for a single location per the spec: a handful of authored
// documents, versioned on material edit — prior versions are kept, not overwritten, which
// matters for chemical-handling-sds-log ("what did the SDS say on a given date") and
// membership-agreement ("what terms did a member actually sign under").
// Not built: the spec's `google-business-profile` source (public policy sync) and
// `generic-custom-webhook`-backed internal wiki — no real GBP/webhook credentials in this
// environment, so every article here is authored directly through the /knowledge-base page
// instead of synced from an external source. review-response-agent doesn't consult this table
// (it makes no Claude call — nothing to ground), and phone-line-agent isn't built (needs a
// real telephony API) so it can't either; only wash-concierge is wired to search it.
const knowledgeArticles = pgTable('knowledge_articles', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  // category: knowledge-article (customer FAQ, cited by wash-concierge) | customer-facing
  // (policy documents) | internal (SOPs, safety procedures — staff-only, never surfaced to
  // wash-concierge's search tool)
  category: text('category').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  version: integer('version').notNull().default(1),
  // previousVersions: [{version, title, body, updatedAt}], oldest first; null until the first edit
  previousVersions: jsonb('previous_versions'),
  updatedBy: uuid('updated_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Business health score (02-intelligence/analytics.md's "Executive View" composite,
// bir.json's exact per-KPI formulas). "Weighting is intentionally visible and editable by
// owner" per the spec — a single-row settings table rather than hardcoded constants, so an
// admin (this app's closest role to the spec's "owner") can rebalance it from the UI without
// a code change. Seeded with the spec's own default weights (0.30/0.25/0.20/0.15/0.10).
const healthScoreWeights = pgTable('health_score_weights', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  membershipPenetration: doublePrecision('membership_penetration').notNull().default(0.3),
  bayUtilization: doublePrecision('bay_utilization').notNull().default(0.25),
  netMembershipGrowth: doublePrecision('net_membership_growth').notNull().default(0.2),
  avgReviewRating: doublePrecision('avg_review_rating').notNull().default(0.15),
  equipmentUptime: doublePrecision('equipment_uptime').notNull().default(0.1),
  updatedBy: uuid('updated_by_id').references(() => users._id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Audit log (01-foundation/security.md's "Audit" section): "every create/update/delete on
// WashOrder, Invoice, Payment, MembershipSubscription, JournalEntry, and Employee writes to
// an append-only audit log: actor (role or agent id), timestamp, before/after diff. Agent
// actions are logged identically to human ones." This app has no separate Invoice/Payment
// entities (fleet billing is a WashOrder.paymentMethod tag posting straight to the ledger,
// and membership charges post directly too — see ledgerService's own header comment), so
// this covers the four entities that actually exist: WashOrder, MembershipSubscription,
// JournalEntry, and Employee. Append-only in practice, not just in name: nothing in this
// app ever updates or deletes a row here.
const auditLogs = pgTable('audit_logs', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  // entity: wash_order | membership_subscription | journal_entry | employee
  entity: text('entity').notNull(),
  entityId: uuid('entity_id').notNull(),
  // action: create | update | delete
  action: text('action').notNull(),
  // actorType: user | agent | system — "system" covers a Stripe webhook event, which isn't a
  // human action or an agent judgment call, just an external event applying a state
  // transition the spec itself already defines (membershipBillingAgent's state machine).
  actorType: text('actor_type').notNull(),
  // actorId: a real Users._id for actorType=user, or a stable agent-name string (e.g.
  // "membership-billing-agent") for actorType=agent/system — not a foreign key, since an
  // agent has no row in the users table to reference.
  actorId: text('actor_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Platform API & Webhooks (06-platform/api-webhooks.md) — "a light but real API surface... the
// fleet segment and a future companion mobile app both need something to integrate against."
// Only the raw key's SHA-256 hash is ever stored (`keyHash`) — the plaintext key is shown to
// the admin exactly once, at creation, same handling as any real API-key system. `keyPrefix`
// (the first 8 chars) is kept in the clear purely so the admin UI can show "which key is
// this" in a list without ever re-displaying the secret.
const apiKeys = pgTable('api_keys', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  // scope: orders-readwrite | fleet-account-readonly — the spec's own two named scopes,
  // "each constrained exactly like the human role it mirrors, including the same ABAC
  // policies" — fleet-account-readonly reuses this app's real fleet-account-manager ABAC
  // scoping (server/src/utils/employeeScope.js's fleetScopeFilter logic), not a separate
  // reimplementation.
  scope: text('scope').notNull(),
  // Required (and only meaningful) for scope=fleet-account-readonly — which fleet account
  // this key is allowed to see, the same "scoped to the fleet segment" boundary a human
  // fleet-account-manager operates within, per-partner rather than shop-wide.
  fleetCustomer: uuid('fleet_customer_id').references(() => customers._id, { onDelete: 'cascade' }),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Outbound webhook subscriptions — one row per subscriber URL, `events` names which of the
// spec's four events it wants (wash-order-ready | wash-order-completed | membership-cancelled
// | stock-low). `secret` HMAC-signs every payload sent to `url`, per-subscriber as the spec
// asks.
const webhookSubscriptions = pgTable('webhook_subscriptions', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Delivery log — what actually makes an event "replayable by event ID rather than leaving a
// subscriber to reconstruct state," per the spec's own text: eventId is stable across every
// retry attempt for the same firing, and a stored row can be manually replayed later without
// re-deriving the payload from scratch. Retries here are immediate, in-process (a few
// attempts with backoff) rather than a durable queue — this app has no job scheduler/worker
// infrastructure (the same documented gap behind the -3d/-2h reminder jobs elsewhere), so a
// subscriber that's down for longer than a couple of seconds needs the manual replay instead.
const webhookDeliveries = pgTable('webhook_deliveries', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  eventType: text('event_type').notNull(),
  subscription: uuid('subscription_id')
    .notNull()
    .references(() => webhookSubscriptions._id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  // status: delivered | failed
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(1),
  responseStatus: integer('response_status'),
  lastError: text('last_error'),
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
  suppliers,
  supplies,
  packageSupplyUsage,
  purchaseOrders,
  purchaseOrderLines,
  stockAdjustments,
  agentMetrics,
  strategyRecommendations,
  fleetInquiries,
  reviews,
  knowledgeArticles,
  healthScoreWeights,
  auditLogs,
  apiKeys,
  webhookSubscriptions,
  webhookDeliveries,
};
