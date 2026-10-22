import { index, sqliteTable, text, timestampMs, timestamps, uid } from '../columns.js';
import { locations, tenants, users } from './platform.js';
import { customers } from './tenant-core.js';
import { washOrders } from './wash.js';

// ---------------------------------------------------------------------------
// Support/CRM — the support half only (no sales pipeline for walk-in service).
//
// State machine (terminal: closed):
//   open -> in-progress -> resolved -> closed
//   in-progress <-> waiting-on-customer
//   waiting-on-customer -> closed (no-response-14-days)
// ---------------------------------------------------------------------------

export const tickets = sqliteTable(
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
    /** category: damage-claim | billing-dispute | quality-complaint | membership-question | general */
    category: text('category').notNull().default('general'),
    /** priority: low | normal | high | urgent */
    priority: text('priority').notNull().default('normal'),
    /** status: open | in-progress | waiting-on-customer | resolved | closed */
    status: text('status').notNull().default('open'),
    description: text('description'),
    assignedTo: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    /** source: whatsapp | phone | google-business-profile | in-app */
    source: text('source').notNull().default('in-app'),
    firstRespondedAt: timestampMs('first_responded_at'),
    resolvedAt: timestampMs('resolved_at'),
    closedAt: timestampMs('closed_at'),
    createdBy: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('idx_tickets_tenant').on(t.tenant, t.status)]
);

/** Internal staff-facing update thread on a ticket. */
export const ticketComments = sqliteTable(
  'ticket_comments',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    ticket: text('ticket_id')
      .notNull()
      .references(() => tickets._id, { onDelete: 'cascade' }),
    author: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    /** authorType: staff | system */
    authorType: text('author_type').notNull().default('staff'),
    body: text('body').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('idx_ticket_comments_tenant').on(t.tenant)]
);
