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
import { employees } from './hr.js';
import { locations, tenants, users } from './platform.js';
import { washPackages } from './wash.js';

// ---------------------------------------------------------------------------
// Inventory & supply chain — chemicals, tunnel/detail supplies, disposables.
// Stock is tracked per LOCATION in `location_stock`; `supplies.quantity_on_hand`
// is the tenant-wide sum.
// ---------------------------------------------------------------------------

export const suppliers = sqliteTable(
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

export const supplies = sqliteTable(
  'supplies',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** warehouse: main-chemical-room | detail-bay-storage */
    warehouse: text('warehouse').notNull().default('main-chemical-room'),
    unit: text('unit').notNull().default('unit'),
    quantityOnHand: real('quantity_on_hand').notNull().default(0),
    unitCost: real('unit_cost').notNull().default(0),
    supplier: text('supplier_id').references(() => suppliers._id, { onDelete: 'set null' }),
    active: bool('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('idx_supplies_tenant').on(t.tenant)]
);

/** Per-location stock for a supply. */
export const locationStock = sqliteTable(
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
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    uniqueIndex('uq_location_stock_location_supply').on(t.location, t.supply),
    index('idx_location_stock_tenant').on(t.tenant),
  ]
);

/** Chemical consumption scales with package mix, not just wash count. */
export const packageSupplyUsage = sqliteTable(
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

/** State machine: Draft -> Sent -> PartiallyReceived -> Received -> Closed. */
export const purchaseOrders = sqliteTable(
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
    /** status: draft | sent | partially-received | received | closed */
    status: text('status').notNull().default('draft'),
    totalAmount: real('total_amount').notNull().default(0),
    source: text('source').notNull().default('manual'),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: text('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestampMs('sent_at'),
    receivedAt: timestampMs('received_at'),
    closedAt: timestampMs('closed_at'),
    ...timestamps,
  },
  (t) => [index('idx_purchase_orders_tenant').on(t.tenant, t.status)]
);

export const purchaseOrderLines = sqliteTable(
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

/** StockAdjustment (shrinkage & write-offs) — requires approval. */
export const stockAdjustments = sqliteTable(
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
    /** negative for a loss, positive for a count-correction */
    quantityDelta: real('quantity_delta').notNull(),
    /** reasonCode: breakage | spillage | theft | expired | count-correction */
    reasonCode: text('reason_code').notNull(),
    notes: text('notes'),
    approvedBy: text('approved_by_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'restrict' }),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_stock_adjustments_tenant').on(t.tenant)]
);
