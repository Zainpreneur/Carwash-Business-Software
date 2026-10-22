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

// ---------------------------------------------------------------------------
// Multi-tenant platform model
// ---------------------------------------------------------------------------
//
// Tenancy shape: a `tenant` is one car-wash BUSINESS (the SaaS customer). A business
// runs one or more `locations` (branches / sites). Every business-scoped row carries a
// `tenant_id`; rows that physically belong to a site (bays, shifts, orders, stock)
// additionally carry a `location_id`.
//
// Isolation is enforced in the data layer (apps/api/src/lib/tenant-db.ts), which
// automatically adds `tenant_id = <active tenant>` to every SELECT/UPDATE/DELETE and
// stamps `tenant_id` on every INSERT.

/** Tenant settings bag (receipt footer, wash-token prefix, ...). */
export type TenantSettings = Record<string, unknown>;

/** SaaS plan feature flags. */
export interface PlanFeatures {
  memberships?: boolean;
  inventory?: boolean;
  hr?: boolean;
  reports?: boolean;
  whatsapp?: boolean;
  [key: string]: boolean | undefined;
}

export const tenants = sqliteTable(
  'tenants',
  {
    _id: uid('_id'),
    name: text('name').notNull(),
    /** URL identifier: /t/<slug> and (optionally) <slug>.<domain>. Immutable after create. */
    slug: text('slug').notNull().unique(),
    /** status: trial | active | suspended | closed */
    status: text('status').notNull().default('trial'),
    /** SaaS plan code — kept as a code (not a FK) so a plan can be renamed without touching tenants. */
    plan: text('plan').notNull().default('starter'),
    logoUrl: text('logo_url'),
    brandColor: text('brand_color').notNull().default('#0284c7'),
    currency: text('currency').notNull().default('USD'),
    timezone: text('timezone').notNull().default('Asia/Riyadh'),
    taxRate: real('tax_rate').notNull().default(0),
    phone: text('phone'),
    address: text('address'),
    settings: json<TenantSettings>('settings'),
    ...timestamps,
  },
  (t) => [index('idx_tenants_status').on(t.status)]
);

/** Custom domains for white-label hosting: wash.example.com -> tenant. */
export const tenantDomains = sqliteTable(
  'tenant_domains',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
    /** primary: used when several domains point at the same tenant */
    primary: bool('primary').notNull().default(false),
    verified: bool('verified').notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_tenant_domains_tenant').on(t.tenant)]
);

/** A site/branch of a tenant business. */
export const locations = sqliteTable(
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
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_locations_tenant_code').on(t.tenant, t.code),
    index('idx_locations_tenant').on(t.tenant),
  ]
);

/** Login accounts. A user is a PLATFORM-level identity (one email = one login). */
export const users = sqliteTable(
  'users',
  {
    id: uid('id'),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: bool('email_verified').notNull().default(false),
    image: text('image'),
    /** platformRole: user | platform_admin (platform_admin = SaaS operator, sees all tenants) */
    platformRole: text('platform_role').notNull().default('user'),
    phone: text('phone'),
    active: bool('active').notNull().default(true),
    avatarColor: text('avatar_color').notNull().default('#2563eb'),
    ...timestamps,
  },
  (t) => [index('idx_users_platform_role').on(t.platformRole)]
);

/** User's role inside a specific tenant. */
export const tenantMembers = sqliteTable(
  'tenant_members',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** role: owner | admin | manager | staff */
    role: text('role').notNull().default('staff'),
    /** status: active | invited | disabled */
    status: text('status').notNull().default('active'),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    scopeAllLocations: bool('scope_all_locations').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_tenant_members_tenant_user').on(t.tenant, t.user),
    index('idx_tenant_members_user').on(t.user),
  ]
);

/** SaaS plan catalogue (what a business pays for). */
export const saasPlans = sqliteTable(
  'saas_plans',
  {
    _id: uid('_id'),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    priceMonthly: real('price_monthly').notNull().default(0),
    maxLocations: integer('max_locations').notNull().default(1),
    maxStaff: integer('max_staff').notNull().default(5),
    maxCustomers: integer('max_customers').notNull().default(500),
    features: json<PlanFeatures>('features'),
    active: bool('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('idx_saas_plans_active').on(t.active)]
);

/** A tenant's subscription to a SaaS plan. */
export const tenantSubscriptions = sqliteTable(
  'tenant_subscriptions',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    plan: text('plan_code').notNull().default('starter'),
    /** status: trialing | active | past_due | canceled */
    status: text('status').notNull().default('trialing'),
    seats: integer('seats').notNull().default(1),
    startedAt: timestamps.createdAt,
    renewsAt: timestampMs('renews_at'),
    canceledAt: timestampMs('canceled_at'),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [index('idx_tenant_subscriptions_tenant').on(t.tenant)]
);

/** Staff invitations issued inside a tenant. */
export const invites = sqliteTable(
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
    invitedBy: text('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestampMs('expires_at').notNull(),
    acceptedAt: timestampMs('accepted_at'),
    acceptedBy: text('accepted_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_invites_tenant').on(t.tenant)]
);

/** Who did what, inside which tenant. */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    user: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    meta: json('meta'),
    ip: text('ip'),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_audit_logs_tenant').on(t.tenant, t.createdAt)]
);
