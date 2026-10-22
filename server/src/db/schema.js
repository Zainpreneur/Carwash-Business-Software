const { randomUUID } = require('crypto');
const {
  sqliteTable,
  text,
  integer,
  real,
  customType,
  index,
  uniqueIndex,
} = require('drizzle-orm/sqlite-core');

// UUID text primary key — libSQL/SQLite has no native uuid type, so IDs are generated
// client-side (crypto.randomUUID) instead of by the server (PG's uuid defaultRandom()).
const uid = (name) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => randomUUID());

// SQLite has no boolean column; store as INTEGER 0/1 mapped to/from JS booleans.
const bool = (name, config = {}) => integer(name, { mode: 'boolean', ...config });

// SQLite has no timestamptz; store as INTEGER milliseconds since epoch, mapped to Date.
const timestampMs = (name, config = {}) => integer(name, { mode: 'timestamp_ms', ...config });

// SQLite has no jsonb; store as TEXT and serialize/deserialize at the column boundary.
const json = (name) =>
  customType({
    dataType: () => 'text',
    toDriver: (value) =>
      value === null || value === undefined ? null : JSON.stringify(value),
    fromDriver: (value) =>
      value === null || value === undefined ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })(name);

// ---------------------------------------------------------------------------
// Multi-tenant platform model
// ---------------------------------------------------------------------------
//
// Tenancy shape: a `tenant` is one car-wash BUSINESS (the SaaS customer). A business
// runs one or more `locations` (branches / sites). Every business-scoped row carries a
// `tenant_id`; rows that physically belong to a site (bays, shifts, orders, stock)
// additionally carry a `location_id`.
//
// Isolation is enforced in the data layer (server/src/db/tenantDb.js), which
// automatically adds `tenant_id = <active tenant>` to every SELECT/UPDATE/DELETE and
// stamps `tenant_id` on every INSERT. Controllers therefore cannot leak data across
// tenants even if they forget to filter.

const tenants = sqliteTable(
  'tenants',
  {
    _id: uid('_id'),
    name: text('name').notNull(),
    // URL identifier: /t/<slug> and (optionally) <slug>.<domain>. Immutable after create.
    slug: text('slug').notNull().unique(),
    // status: trial | active | suspended | closed
    status: text('status').notNull().default('trial'),
    // SaaS plan code — see `saas_plans`. Kept as a code (not a FK) so a plan row can be
    // edited/renamed without touching every tenant.
    plan: text('plan').notNull().default('starter'),
    // White-label branding
    logoUrl: text('logo_url'),
    brandColor: text('brand_color').notNull().default('#0284c7'),
    // Business profile / localisation
    currency: text('currency').notNull().default('USD'),
    timezone: text('timezone').notNull().default('Asia/Riyadh'),
    taxRate: real('tax_rate').notNull().default(0),
    phone: text('phone'),
    address: text('address'),
    // free-form tenant settings (receipt footer, wash-token prefix, ...)
    settings: json('settings'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_tenants_status').on(t.status)]
);

// Custom domains for white-label hosting: wash.example.com -> tenant.
const tenantDomains = sqliteTable(
  'tenant_domains',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
    // primary: used when several domains point at the same tenant
    primary: bool('primary').notNull().default(false),
    verified: bool('verified').notNull().default(false),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_tenant_domains_tenant').on(t.tenant)]
);

// A site/branch of a tenant business.
const locations = sqliteTable(
  'locations',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: text('address'),
    city: text('city'),
    country: text('country'),
    phone: text('phone'),
    timezone: text('timezone'),
    active: bool('active').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('uq_locations_tenant_code').on(t.tenant, t.code),
    index('idx_locations_tenant').on(t.tenant),
  ]
);

// Login accounts. A user is a PLATFORM-level identity (one email = one login) and
// joins one or more tenants through `tenant_members`. `platformRole` is only set for
// the SaaS operator's own staff.
const users = sqliteTable(
  'users',
  {
    _id: uid('_id'),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    // platformRole: user | platform_admin  (platform_admin = SaaS operator, sees all tenants)
    platformRole: text('platform_role').notNull().default('user'),
    phone: text('phone'),
    active: bool('active').notNull().default(true),
    avatarColor: text('avatar_color').notNull().default('#2563eb'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_users_platform_role').on(t.platformRole)]
);

// Membership of a user in a tenant, carrying the role *inside that tenant*. A user can be
// an owner of one business and a staff member of another with the same login.
const tenantMembers = sqliteTable(
  'tenant_members',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id')
      .notNull()
      .references(() => users._id, { onDelete: 'cascade' }),
    // role: owner | admin | manager | staff
    role: text('role').notNull().default('staff'),
    // status: active | invited | disabled
    status: text('status').notNull().default('active'),
    // Home location for location-scoped staff; null + scopeAllLocations = every location.
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    scopeAllLocations: bool('scope_all_locations').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('uq_tenant_members_tenant_user').on(t.tenant, t.user),
    index('idx_tenant_members_user').on(t.user),
  ]
);

// SaaS plan catalogue (what a business pays for). Feature flags live in `features`.
const saasPlans = sqliteTable(
  'saas_plans',
  {
    _id: uid('_id'),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    priceMonthly: real('price_monthly').notNull().default(0),
    // Limits — enforced server-side on the tenant's own resources.
    maxLocations: integer('max_locations').notNull().default(1),
    maxStaff: integer('max_staff').notNull().default(5),
    maxCustomers: integer('max_customers').notNull().default(500),
    // { memberships: true, inventory: true, hr: true, reports: true, whatsapp: true }
    features: json('features'),
    active: bool('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_saas_plans_active').on(t.active)]
);

// A tenant's subscription to a SaaS plan.
const tenantSubscriptions = sqliteTable(
  'tenant_subscriptions',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    plan: text('plan_code').notNull().default('starter'),
    // status: trialing | active | past_due | canceled
    status: text('status').notNull().default('trialing'),
    seats: integer('seats').notNull().default(1),
    startedAt: timestampMs('started_at').notNull().$defaultFn(() => new Date()),
    renewsAt: timestampMs('renews_at'),
    canceledAt: timestampMs('canceled_at'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_tenant_subscriptions_tenant').on(t.tenant)]
);

// Staff invitations issued inside a tenant.
const invites = sqliteTable(
  'invites',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('staff'),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    code: text('code').notNull().unique(),
    invitedBy: text('invited_by_id').references(() => users._id, { onDelete: 'set null' }),
    expiresAt: timestampMs('expires_at').notNull(),
    acceptedAt: timestampMs('accepted_at'),
    acceptedBy: text('accepted_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_invites_tenant').on(t.tenant)]
);

// Who did what, inside which tenant.
const auditLogs = sqliteTable(
  'audit_logs',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id').references(() => users._id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    meta: json('meta'),
    ip: text('ip'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_audit_logs_tenant').on(t.tenant, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Tenant-owned business data
// ---------------------------------------------------------------------------

const customers = sqliteTable(
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
    // gates transactional WhatsApp messaging (carwash-compile/01-foundation/data-model.md);
    // used by the notify-ready-for-pickup automation.
    whatsappOptIn: bool('whatsapp_opt_in').notNull().default(true),
    // set once a Stripe Customer exists for this customer (membership billing only —
    // never created for a plain pay-per-wash visit).
    stripeCustomerId: text('stripe_customer_id'),
    // fleet-lead segment key (04-growth/marketing.md's "Fleet/Commercial" segment) — set
    // manually by staff; no automatic detection from wash volume alone.
    isFleetAccount: bool('is_fleet_account').notNull().default(false),
    // Referral program (04-growth/marketing.md): every customer gets a stable referralCode
    // once generated; referredByCode records whose code got them in the door, checked once
    // against washOrderController.checkout's first-completed-order crediting logic.
    referralCode: text('referral_code'),
    referredByCode: text('referred_by_code'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_customers_tenant').on(t.tenant),
    uniqueIndex('uq_customers_tenant_referral').on(t.tenant, t.referralCode),
  ]
);

const vehicles = sqliteTable(
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
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_vehicles_tenant').on(t.tenant),
    index('idx_vehicles_tenant_plate').on(t.tenant, t.plateNumber),
  ]
);

const services = sqliteTable(
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
    vehicleTypePricing: json('vehicle_type_pricing'),
    active: bool('active').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_services_tenant').on(t.tenant)]
);

const bookings = sqliteTable(
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
    assignedStaff: text('assigned_staff_id').references(() => users._id, { onDelete: 'set null' }),
    scheduledAt: timestampMs('scheduled_at').notNull(),
    status: text('status').notNull().default('pending'),
    priority: text('priority').notNull().default('normal'),
    subtotal: real('subtotal').notNull().default(0),
    discount: real('discount').notNull().default(0),
    tax: real('tax').notNull().default(0),
    total: real('total').notNull().default(0),
    paymentStatus: text('payment_status').notNull().default('unpaid'),
    paymentMethod: text('payment_method').notNull().default('cash'),
    notes: text('notes'),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_bookings_tenant').on(t.tenant),
    index('idx_bookings_tenant_location').on(t.tenant, t.location),
    index('idx_bookings_tenant_scheduled').on(t.tenant, t.scheduledAt),
    uniqueIndex('uq_bookings_tenant_number').on(t.tenant, t.bookingNumber),
  ]
);

const bookingServices = sqliteTable(
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

const expenses = sqliteTable(
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
    date: timestampMs('date').notNull().$defaultFn(() => new Date()),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_expenses_tenant').on(t.tenant, t.date)]
);

const notifications = sqliteTable(
  'notifications',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id')
      .notNull()
      .references(() => users._id, { onDelete: 'cascade' }),
    booking: text('booking_id').references(() => bookings._id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('info'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    read: bool('read').notNull().default(false),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_notifications_tenant_user').on(t.tenant, t.user)]
);

// --- SplashPoint wash-floor module (compiled spec, Phase 1: WashOrder/Vehicle/Customer/
// ServiceBay primary lifecycle only — see carwash-compile/01-foundation/data-model.md).
// Statuses/enums are lower-kebab-case to match this app's existing convention; they map
// 1:1 to the spec's PascalCase state names (e.g. "bay-assigned" = BayAssigned).

const washPackages = sqliteTable(
  'wash_packages',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    // tier: express-exterior | exterior-plus | signature-full-service | premium-hand-detail
    tier: text('tier').notNull(),
    name: text('name').notNull(),
    // deliveryLane: tunnel | detail-bay — which lane type this package runs in
    deliveryLane: text('delivery_lane').notNull().default('tunnel'),
    includesInterior: bool('includes_interior').notNull().default(false),
    avgCycleTimeMinutes: integer('avg_cycle_time_minutes').notNull().default(15),
    active: bool('active').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_wash_packages_tenant').on(t.tenant)]
);

// PackagePricing join entity: a package's price varies by 3-tier vehicle size
// (sedan-coupe | suv-truck | van-oversized — motorcycles/oversized rigs are quoted
// manually per the spec's assumptions, so they have no row here).
const packagePricing = sqliteTable(
  'package_pricing',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    package: text('package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'cascade' }),
    vehicleType: text('vehicle_type').notNull(),
    price: real('price').notNull(),
  },
  (t) => [index('idx_package_pricing_tenant').on(t.tenant)]
);

const serviceBays = sqliteTable(
  'service_bays',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id')
      .notNull()
      .references(() => locations._id, { onDelete: 'cascade' }),
    bayNumber: integer('bay_number').notNull(),
    // bayType: tunnel-conveyor | detail-bay
    bayType: text('bay_type').notNull().default('tunnel-conveyor'),
    // operationalStatus: operational | degraded | down | retired
    operationalStatus: text('operational_status').notNull().default('operational'),
    avgThroughputPerHour: real('avg_throughput_per_hour'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_service_bays_tenant').on(t.tenant),
    index('idx_service_bays_location').on(t.location),
    uniqueIndex('uq_service_bays_location_number').on(t.location, t.bayNumber),
  ]
);

// WashOrder: the primary lifecycle entity — a vehicle's trip through the wash.
// State machine (terminal: completed, cancelled):
//   queued -> bay-assigned -> in-wash -> quality-check -> ready-for-pickup -> completed
//   quality-check -> in-wash (qc failed, rework)
//   queued | bay-assigned -> cancelled
const washOrders = sqliteTable(
  'wash_orders',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    orderNumber: text('order_number').notNull(),
    // nullable — anonymous walk-in cash wash is allowed per the spec
    customer: text('customer_id').references(() => customers._id, { onDelete: 'set null' }),
    vehicle: text('vehicle_id')
      .notNull()
      .references(() => vehicles._id, { onDelete: 'cascade' }),
    package: text('package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'restrict' }),
    bay: text('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
    assignedTechnician: text('assigned_technician_id').references(() => users._id, { onDelete: 'set null' }),
    // bookingType: walk-in | appointment
    bookingType: text('booking_type').notNull().default('walk-in'),
    scheduledFor: timestampMs('scheduled_for'),
    queuePosition: integer('queue_position'),
    queuedAt: timestampMs('queued_at').notNull().$defaultFn(() => new Date()),
    bayAssignedAt: timestampMs('bay_assigned_at'),
    washStartedAt: timestampMs('wash_started_at'),
    washCompletedAt: timestampMs('wash_completed_at'),
    checkedOutAt: timestampMs('checked_out_at'),
    status: text('status').notNull().default('queued'),
    // qcResult: pass | fail — set by a human technician only
    qcResult: text('qc_result'),
    price: real('price').notNull(),
    // paymentMethod: membership | card | cash | fleet-invoice
    paymentMethod: text('payment_method').notNull().default('cash'),
    promoCode: text('promo_code'),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_wash_orders_tenant').on(t.tenant),
    index('idx_wash_orders_tenant_location').on(t.tenant, t.location),
    index('idx_wash_orders_tenant_status').on(t.tenant, t.status),
    uniqueIndex('uq_wash_orders_tenant_number').on(t.tenant, t.orderNumber),
  ]
);

// Outbound customer message log (03-operations/automations.md). Sends for real through the
// WhatsApp Cloud API when WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID are configured (see
// utils/whatsapp.js) — status records the outcome (sent/failed); stays 'not_configured'
// otherwise. Either way, this is the audit trail: which automation decided to message a
// customer, with what template, and what happened.
const customerMessages = sqliteTable(
  'customer_messages',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
    washOrder: text('wash_order_id').references(() => washOrders._id, { onDelete: 'set null' }),
    channel: text('channel').notNull().default('whatsapp'),
    template: text('template').notNull(),
    automation: text('automation').notNull(),
    status: text('status').notNull().default('queued'),
    error: text('error'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_customer_messages_tenant').on(t.tenant)]
);

// --- Membership billing (carwash-compile/01-foundation/data-model.md "Membership" +
// 06-platform/integrations.md Stripe entry). Bills for real through Stripe Checkout +
// subscriptions when STRIPE_SECRET_KEY is configured (see config/stripe.js); degrades to a
// locally-tracked "active" subscription with no real billing when it isn't, so the feature
// is demoable without live keys. The spec lists Stripe's auth as oauth2 (Stripe Connect,
// for a platform onboarding many merchant sub-accounts) — this is a single-location
// business integrating its own account directly, so a secret-key integration is the
// correct simplification, not Connect.

const membershipPlans = sqliteTable(
  'membership_plans',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    // tier: basic-unlimited | premium-unlimited | fleet-unlimited
    tier: text('tier').notNull(),
    name: text('name').notNull(),
    coveredPackage: text('covered_package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'restrict' }),
    monthlyPrice: real('monthly_price').notNull(),
    isUnlimited: bool('is_unlimited').notNull().default(true),
    washesPerMonthCap: integer('washes_per_month_cap'),
    rolloverAllowed: bool('rollover_allowed').notNull().default(false),
    // set once this plan has been synced to Stripe as a Product+Price (see membershipController).
    stripePriceId: text('stripe_price_id'),
    active: bool('active').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_membership_plans_tenant').on(t.tenant)]
);

// State machine (terminal: cancelled): active -> past-due (billing-charge-failed) ->
// suspended (7 days unresolved) -> cancelled (30 days unresolved) | active (paid manually);
// active <-> paused (customer-requested); active -> cancelled (customer-cancelled).
const membershipSubscriptions = sqliteTable(
  'membership_subscriptions',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
    // plate-linked, one active-at-a-time — enforced in membershipController, not a DB
    // constraint (a vehicle may have a past cancelled subscription on record).
    vehicle: text('vehicle_id')
      .notNull()
      .references(() => vehicles._id, { onDelete: 'cascade' }),
    plan: text('plan_id')
      .notNull()
      .references(() => membershipPlans._id, { onDelete: 'restrict' }),
    billingDayOfMonth: integer('billing_day_of_month').notNull(),
    nextBillingDate: timestampMs('next_billing_date'),
    pausedUntil: timestampMs('paused_until'),
    washesThisCycle: integer('washes_this_cycle').notNull().default(0),
    failedPaymentAttempts: integer('failed_payment_attempts').notNull().default(0),
    // Set the moment a subscription first goes past-due; cleared on any return to active.
    firstFailedAt: timestampMs('first_failed_at'),
    status: text('status').notNull().default('active'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_membership_subscriptions_tenant').on(t.tenant)]
);

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
const tickets = sqliteTable(
  'tickets',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
    washOrder: text('wash_order_id').references(() => washOrders._id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    // category: damage-claim | billing-dispute | quality-complaint | membership-question | general
    category: text('category').notNull().default('general'),
    priority: text('priority').notNull().default('normal'), // low | normal | high | urgent
    status: text('status').notNull().default('open'),
    description: text('description'),
    assignedTo: text('assigned_to_id').references(() => users._id, { onDelete: 'set null' }),
    // source: whatsapp | phone | google-business-profile | in-app — supportChannels in crm.md
    source: text('source').notNull().default('in-app'),
    firstRespondedAt: timestampMs('first_responded_at'),
    resolvedAt: timestampMs('resolved_at'),
    closedAt: timestampMs('closed_at'),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_tickets_tenant').on(t.tenant, t.status)]
);

// Internal staff-facing update thread on a ticket. This is staff notes and status-change
// log, not a unified omni-channel thread (documented gap, see README).
const ticketComments = sqliteTable(
  'ticket_comments',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    ticket: text('ticket_id')
      .notNull()
      .references(() => tickets._id, { onDelete: 'cascade' }),
    author: text('author_id').references(() => users._id, { onDelete: 'set null' }),
    // authorType: staff | system — system for auto-logged state changes
    authorType: text('author_type').notNull().default('staff'),
    body: text('body').notNull(),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_ticket_comments_tenant').on(t.tenant)]
);

// --- HR (carwash-compile/03-operations/hr.md). "A real staff roster for a 6-bay
// site: bay-attendants, wash-technicians, detail-technicians, cashiers, a site-manager, and
// a part-time fleet-account-manager." Employee is explicitly distinct from the login/RBAC
// role carried by `tenant_members` (see the spec's own note); `employees.user` links the two
// but is nullable — an Employee record can exist (e.g. an Applicant not yet given a login)
// without a `users` row, and vice versa (an admin login with no HR record).
const employees = sqliteTable(
  'employees',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    user: text('user_id').references(() => users._id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    // position: bay-attendant | wash-technician | detail-technician | cashier | site-manager |
    // fleet-account-manager — the spec's own compensation table keys off this.
    position: text('position').notNull(),
    // status: applicant | hired | onboarding | active | on-leave | offboarded (the spec's
    // own Employee lifecycle).
    status: text('status').notNull().default('active'),
    hireDate: timestampMs('hire_date'),
    // Exactly one of hourlyRate/annualSalary is set, matching the spec's compensation table:
    // bay-attendant/wash-technician/cashier/fleet-account-manager are hourly, site-manager is
    // salaried. commissionRate is detail-technician only (10% of PackagePricing.price on
    // completed detail-bay WashOrders, per the spec's own commission basis).
    hourlyRate: real('hourly_rate'),
    annualSalary: real('annual_salary'),
    commissionRate: real('commission_rate'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_employees_tenant').on(t.tenant)]
);

// schedulingEntity: Shift (employeeId x time window x optional bayId), per the spec.
// checkedInAt/checkedOutAt are this app's own addition — the spec's shift-no-show-alert
// automation needs *something* to detect a no-show against, and this app has no clock-in
// hardware/kiosk, so a staff member (or the employee via a future self-service view, not
// built) marks it here instead.
const shifts = sqliteTable(
  'shifts',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    employee: text('employee_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'cascade' }),
    bay: text('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
    startsAt: timestampMs('starts_at').notNull(),
    endsAt: timestampMs('ends_at').notNull(),
    // status: scheduled | completed | no-show | cancelled
    status: text('status').notNull().default('scheduled'),
    checkedInAt: timestampMs('checked_in_at'),
    checkedOutAt: timestampMs('checked_out_at'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_shifts_tenant').on(t.tenant, t.startsAt)]
);

// Leave management: "request -> site-manager approval -> calendar block ... so Shift
// scheduling automatically respects it". The google-calendar half of that isn't built (no
// such integration exists in this app); instead shiftController blocks creating a new Shift
// that overlaps an *approved* leave request directly against this table — same end result
// for this app's own UI, without a real calendar. The spec's 10-PTO-days/year monthly
// accrual math isn't computed here either (documented, not silently assumed) — this is a
// request/approve workflow only.
const leaveRequests = sqliteTable(
  'leave_requests',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    employee: text('employee_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'cascade' }),
    startDate: timestampMs('start_date').notNull(),
    endDate: timestampMs('end_date').notNull(),
    reason: text('reason'),
    // status: pending | approved | denied
    status: text('status').notNull().default('pending'),
    approvedBy: text('approved_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_leave_requests_tenant').on(t.tenant)]
);

// --- Inventory & supply chain (carwash-compile/03-operations/inventory.md). "Chemicals,
// tunnel/detail supplies, and disposables - not durable equipment" (that's assets-iot.md's
// domain, not built). Supply is the spec's own catalogue entity; Stock is tracked per
// LOCATION in `location_stock` because a chain's chemical room and a branch's detail bay
// hold different quantities.
const suppliers = sqliteTable(
  'suppliers',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    leadTimeDays: integer('lead_time_days').notNull(),
  },
  (t) => [index('idx_suppliers_tenant').on(t.tenant)]
);

const supplies = sqliteTable(
  'supplies',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // warehouse: main-chemical-room | detail-bay-storage — kept separate per the spec's own
    // reasoning ("a detail-bay stockout doesn't get masked by chemical-room supply").
    warehouse: text('warehouse').notNull().default('main-chemical-room'),
    unit: text('unit').notNull().default('unit'), // e.g. gallon, case, roll
    // Tenant-wide total on hand (sum across locations). Per-location quantities live in
    // `location_stock`.
    quantityOnHand: real('quantity_on_hand').notNull().default(0),
    unitCost: real('unit_cost').notNull().default(0),
    supplier: text('supplier_id').references(() => suppliers._id, { onDelete: 'set null' }),
    active: bool('active').notNull().default(true),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_supplies_tenant').on(t.tenant)]
);

// Per-location stock for a supply. The tenant-wide `supplies.quantity_on_hand` is the sum.
const locationStock = sqliteTable(
  'location_stock',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id')
      .notNull()
      .references(() => locations._id, { onDelete: 'cascade' }),
    supply: text('supply_id')
      .notNull()
      .references(() => supplies._id, { onDelete: 'cascade' }),
    quantityOnHand: real('quantity_on_hand').notNull().default(0),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('uq_location_stock_location_supply').on(t.location, t.supply),
    index('idx_location_stock_tenant').on(t.tenant),
  ]
);

// "Chemical consumption scales with package mix, not just wash count" — how much of a given
// Supply one wash of a given WashPackage consumes.
const packageSupplyUsage = sqliteTable(
  'package_supply_usage',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    package: text('package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'cascade' }),
    supply: text('supply_id')
      .notNull()
      .references(() => supplies._id, { onDelete: 'cascade' }),
    quantityPerWash: real('quantity_per_wash').notNull(),
  },
  (t) => [index('idx_package_supply_usage_tenant').on(t.tenant)]
);

// State machine: Draft -> Sent -> PartiallyReceived -> Received -> Closed.
const purchaseOrders = sqliteTable(
  'purchase_orders',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    supplier: text('supplier_id')
      .notNull()
      .references(() => suppliers._id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('draft'),
    totalAmount: real('total_amount').notNull().default(0),
    source: text('source').notNull().default('manual'),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    approvedBy: text('approved_by_id').references(() => users._id, { onDelete: 'set null' }),
    sentAt: timestampMs('sent_at'),
    receivedAt: timestampMs('received_at'),
    closedAt: timestampMs('closed_at'),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_purchase_orders_tenant').on(t.tenant, t.status)]
);

const purchaseOrderLines = sqliteTable(
  'purchase_order_lines',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    purchaseOrder: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders._id, { onDelete: 'cascade' }),
    supply: text('supply_id')
      .notNull()
      .references(() => supplies._id, { onDelete: 'restrict' }),
    quantityOrdered: real('quantity_ordered').notNull(),
    quantityReceived: real('quantity_received').notNull().default(0),
    unitCost: real('unit_cost').notNull(),
  },
  (t) => [index('idx_purchase_order_lines_tenant').on(t.tenant)]
);

// StockAdjustment (shrinkage & write-offs) — "always requiring approvedBy ... same approval
// discipline as a discount/refund". approvedBy references an Employee (not a bare users
// row) since the spec explicitly calls out this is an HR-tracked accountability, not just
// whoever's logged in.
const stockAdjustments = sqliteTable(
  'stock_adjustments',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    supply: text('supply_id')
      .notNull()
      .references(() => supplies._id, { onDelete: 'cascade' }),
    // quantityDelta: negative for a loss (breakage/spillage/theft/expired), positive for a
    // count-correction that found more stock than the system expected.
    quantityDelta: real('quantity_delta').notNull(),
    // reasonCode: breakage | spillage | theft | expired | count-correction
    reasonCode: text('reason_code').notNull(),
    notes: text('notes'),
    approvedBy: text('approved_by_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'restrict' }),
    createdBy: text('created_by_id').references(() => users._id, { onDelete: 'set null' }),
    createdAt: timestampMs('created_at').notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('idx_stock_adjustments_tenant').on(t.tenant)]
);

module.exports = {
  // platform
  tenants,
  tenantDomains,
  locations,
  users,
  tenantMembers,
  saasPlans,
  tenantSubscriptions,
  invites,
  auditLogs,
  // tenant-owned
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
  tickets,
  ticketComments,
  employees,
  shifts,
  leaveRequests,
  suppliers,
  supplies,
  locationStock,
  packageSupplyUsage,
  purchaseOrders,
  purchaseOrderLines,
  stockAdjustments,
};
