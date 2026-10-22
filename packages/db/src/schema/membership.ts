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
} from '../columns.js';
import { tenants } from './platform.js';
import { customers, vehicles } from './tenant-core.js';
import { washPackages } from './wash.js';

// ---------------------------------------------------------------------------
// Membership billing (Stripe Checkout + subscriptions when configured)
// ---------------------------------------------------------------------------

export const membershipPlans = sqliteTable(
  'membership_plans',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    /** tier: basic-unlimited | premium-unlimited | fleet-unlimited */
    tier: text('tier').notNull(),
    name: text('name').notNull(),
    coveredPackage: text('covered_package_id')
      .notNull()
      .references(() => washPackages._id, { onDelete: 'restrict' }),
    monthlyPrice: real('monthly_price').notNull(),
    isUnlimited: bool('is_unlimited').notNull().default(true),
    washesPerMonthCap: integer('washes_per_month_cap'),
    rolloverAllowed: bool('rollover_allowed').notNull().default(false),
    stripePriceId: text('stripe_price_id'),
    active: bool('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('idx_membership_plans_tenant').on(t.tenant)]
);

/**
 * State machine (terminal: cancelled):
 *   active -> past-due -> suspended -> cancelled | active (paid manually)
 *   active <-> paused (customer-requested)
 *   active -> cancelled (customer-cancelled)
 */
export const membershipSubscriptions = sqliteTable(
  'membership_subscriptions',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    customer: text('customer_id')
      .notNull()
      .references(() => customers._id, { onDelete: 'cascade' }),
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
    firstFailedAt: timestampMs('first_failed_at'),
    /** status: active | paused | past-due | suspended | cancelled */
    status: text('status').notNull().default('active'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    ...timestamps,
  },
  (t) => [index('idx_membership_subscriptions_tenant').on(t.tenant)]
);
