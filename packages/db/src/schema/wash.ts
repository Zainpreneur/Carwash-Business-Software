import {
  bool,
  index,
  integer,
  real,
  sqliteTable,
  text,
  timestampMs,
  timestamps,
  uid,
  uniqueIndex,
} from '../columns.js';
import { locations, tenants, users } from './platform.js';
import { customers, vehicles } from './tenant-core.js';

// ---------------------------------------------------------------------------
// SplashPoint wash-floor module
// Statuses/enums are lower-kebab-case, mapping 1:1 to PascalCase state names
// (e.g. "bay-assigned" = BayAssigned).
// ---------------------------------------------------------------------------

export const washPackages = sqliteTable(
  'wash_packages',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    /** tier: express-exterior | exterior-plus | signature-full-service | premium-hand-detail */
    tier: text('tier').notNull(),
    name: text('name').notNull(),
    /** deliveryLane: tunnel | detail-bay */
    deliveryLane: text('delivery_lane').notNull().default('tunnel'),
    includesInterior: bool('includes_interior').notNull().default(false),
    avgCycleTimeMinutes: integer('avg_cycle_time_minutes').notNull().default(15),
    active: bool('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('idx_wash_packages_tenant').on(t.tenant)]
);

/** PackagePricing join: a package's price varies by 3-tier vehicle size. */
export const packagePricing = sqliteTable(
  'package_pricing',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    package: text('package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'cascade' }),
    /** vehicleType: sedan-coupe | suv-truck | van-oversized */
    vehicleType: text('vehicle_type').notNull(),
    price: real('price').notNull(),
  },
  (t) => [index('idx_package_pricing_tenant').on(t.tenant)]
);

export const serviceBays = sqliteTable(
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
    /** bayType: tunnel-conveyor | detail-bay */
    bayType: text('bay_type').notNull().default('tunnel-conveyor'),
    /** operationalStatus: operational | degraded | down | retired */
    operationalStatus: text('operational_status').notNull().default('operational'),
    avgThroughputPerHour: real('avg_throughput_per_hour'),
    ...timestamps,
  },
  (t) => [
    index('idx_service_bays_tenant').on(t.tenant),
    index('idx_service_bays_location').on(t.location),
    uniqueIndex('uq_service_bays_location_number').on(t.location, t.bayNumber),
  ]
);

/**
 * WashOrder: the primary lifecycle entity — a vehicle's trip through the wash.
 * State machine (terminal: completed, cancelled):
 *   queued -> bay-assigned -> in-wash -> quality-check -> ready-for-pickup -> completed
 *   quality-check -> in-wash (qc failed, rework)
 *   queued | bay-assigned -> cancelled
 */
export const washOrders = sqliteTable(
  'wash_orders',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    orderNumber: text('order_number').notNull(),
    /** nullable — anonymous walk-in cash wash is allowed */
    customer: text('customer_id').references(() => customers._id, { onDelete: 'set null' }),
    vehicle: text('vehicle_id')
      .notNull()
      .references(() => vehicles._id, { onDelete: 'cascade' }),
    package: text('package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'restrict' }),
    bay: text('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
    assignedTechnician: text('assigned_technician_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** bookingType: walk-in | appointment */
    bookingType: text('booking_type').notNull().default('walk-in'),
    scheduledFor: timestampMs('scheduled_for'),
    queuePosition: integer('queue_position'),
    queuedAt: timestampMs('queued_at')
      .notNull()
      .$defaultFn(() => new Date()),
    bayAssignedAt: timestampMs('bay_assigned_at'),
    washStartedAt: timestampMs('wash_started_at'),
    washCompletedAt: timestampMs('wash_completed_at'),
    checkedOutAt: timestampMs('checked_out_at'),
    /** status: queued | bay-assigned | in-wash | quality-check | ready-for-pickup | completed | cancelled */
    status: text('status').notNull().default('queued'),
    /** qcResult: pass | fail — set by a human technician only */
    qcResult: text('qc_result'),
    price: real('price').notNull(),
    /** paymentMethod: membership | card | cash | fleet-invoice */
    paymentMethod: text('payment_method').notNull().default('cash'),
    promoCode: text('promo_code'),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('idx_wash_orders_tenant').on(t.tenant),
    index('idx_wash_orders_tenant_location').on(t.tenant, t.location),
    index('idx_wash_orders_tenant_status').on(t.tenant, t.status),
    uniqueIndex('uq_wash_orders_tenant_number').on(t.tenant, t.orderNumber),
  ]
);

/** Outbound customer message log (WhatsApp Cloud API audit trail). */
export const customerMessages = sqliteTable(
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
    /** status: queued | sent | failed | not_configured */
    status: text('status').notNull().default('queued'),
    error: text('error'),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_customer_messages_tenant').on(t.tenant)]
);
