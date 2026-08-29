// Auto-posting (05-finance/accounting.md's "Auto-posting rule": "every workflow step that
// moves money ... generates its journal entry automatically ... no manual bookkeeping for
// routine transactions"). Every call site in this file is fire-and-forget from the caller's
// perspective (wrapped in .catch(() => {}) where it's invoked) — a ledger-posting failure
// must never block the customer-facing action (checkout, membership signup) that triggered
// it; it's logged instead, same posture this app already takes with WhatsApp sends and
// other side effects.
const { db } = require('../config/db');
const { journalEntries, journalLines } = require('../db/schema');
const { logAudit } = require('../utils/auditLog');

// Tax is backed out of WashOrder.price as a tax-inclusive total (the price a customer is
// actually charged), not added on top — this app has no separate tax field on WashOrder to
// read instead. 5% matches the rate this app's own legacy booking flow already uses
// (server/src/utils/seed.js), overridable via SALES_TAX_RATE for a real deployment's actual
// local rate (the spec's own "rate set at deployment").
const TAX_RATE = Number(process.env.SALES_TAX_RATE) || 0.05;

const round2 = (n) => Math.round(n * 100) / 100;

// The only way a JournalEntry gets created — enforces the double-entry invariant so an
// unbalanced entry (a bug in one of the posting functions below) fails loudly instead of
// silently corrupting the books. Also the single choke point for JournalEntry's audit-log
// entry (01-foundation/security.md) — every real posting function below funnels through
// here, so logging it once here covers all of them rather than repeating it at each site.
// `actor` is optional and defaults to a system actor. Threaded through from req.user at the
// checkout/expense/fleet-collection/membership call sites (the ones this phase touched);
// inventoryService's purchase-order/stock-adjustment postings and payrollService's payroll-run
// posting don't pass one yet, so those JournalEntry rows log with actorType 'system' rather
// than the real staff member who triggered them — a documented gap, not a silent one, left
// for a future pass rather than expanding this phase into two more controllers.
const postEntry = async ({ memo, sourceEntity, sourceId, lines, actor }) => {
  const totalDebit = round2(lines.reduce((sum, l) => sum + (l.debit || 0), 0));
  const totalCredit = round2(lines.reduce((sum, l) => sum + (l.credit || 0), 0));
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry "${memo}": debit ${totalDebit} !== credit ${totalCredit}`);
  }
  const [entry] = await db.insert(journalEntries).values({ memo, sourceEntity, sourceId }).returning();
  const insertedLines = await db
    .insert(journalLines)
    .values(
      lines
        .filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0)
        .map((l) => ({ entry: entry._id, account: l.account, debit: l.debit || 0, credit: l.credit || 0 }))
    )
    .returning();
  logAudit({
    entity: 'journal_entry',
    entityId: entry._id,
    action: 'create',
    actorType: actor?.actorType || 'system',
    actorId: actor?.actorId || null,
    after: { ...entry, lines: insertedLines },
  });
  return entry;
};

// WashOrder checkout (the spec's own first example). A membership-paid visit isn't a new
// charge — the customer already paid via their subscription — so it posts nothing here; the
// revenue was recognized when the subscription was charged (see postMembershipCharge).
// paymentMethod "fleet-invoice" debits Accounts Receivable instead of Cash and credits
// Fleet/Commercial Revenue instead of Pay-Per-Wash Revenue — the spec's own account split.
const postWashOrderCheckout = async (order, actor) => {
  if (order.paymentMethod === 'membership') return null;
  const total = Number(order.price);
  const tax = round2(total - total / (1 + TAX_RATE));
  const revenue = round2(total - tax);
  const isFleet = order.paymentMethod === 'fleet-invoice';
  return postEntry({
    memo: `Wash order ${order.orderNumber} checkout (${order.paymentMethod})`,
    sourceEntity: 'wash_order',
    sourceId: order._id,
    lines: [
      { account: isFleet ? '1100' : '1000', debit: total },
      { account: isFleet ? '4200' : '4000', credit: revenue },
      { account: '2100', credit: tax },
    ],
    actor,
  });
};

// A successful membership charge (Stripe's invoice.payment_succeeded, or the local
// demo-mode signup that simulates one — see membershipService.js). "Membership revenue is
// recognized at charge, not deferred over the month" per the spec's own reasoning: this
// plan is unlimited-use, not a fixed-deliverable prepayment.
const postMembershipCharge = async (subscription, amount, memo, actor) =>
  postEntry({
    memo: memo || `Membership charge`,
    sourceEntity: 'membership_subscription',
    sourceId: subscription._id,
    lines: [
      { account: '1000', debit: round2(amount) },
      { account: '4100', credit: round2(amount) },
    ],
    actor,
  });

// This app's pre-existing Expense entity isn't in the spec's own data model, but it's the
// natural expense side of the same ledger — every expense category maps onto one of the
// spec's chart-of-accounts expense lines. Assumes the expense is paid in cash immediately
// (credits 1000 Cash directly) — this app has no Accounts Payable / accrued-invoice
// workflow, so "post accrued supplier invoices" from the spec's period-close checklist
// isn't built.
const EXPENSE_ACCOUNTS = {
  supplies: '5100',
  utilities: '5200',
  salaries: '5000',
  maintenance: '5300',
  rent: '5800',
  marketing: '5500',
};
const expenseAccountFor = (category) => EXPENSE_ACCOUNTS[category] || '5100';

const postExpense = async (expense, actor) =>
  postEntry({
    memo: expense.description,
    sourceEntity: 'expense',
    sourceId: expense._id,
    lines: [
      { account: expenseAccountFor(expense.category), debit: round2(expense.amount) },
      { account: '1000', credit: round2(expense.amount) },
    ],
    actor,
  });

// Ledger entries are never mutated once posted (the spec's own period-close step 6, "lock
// the period from further edits") — deleting an expense posts a reversing entry instead of
// touching the original. Editing an already-posted expense's amount/category does NOT
// currently re-post a correction (a documented simplification, not silently wrong: delete
// and re-create the expense to correct the ledger too).
const reverseExpense = async (expense, actor) =>
  postEntry({
    memo: `Reversal: ${expense.description}`,
    sourceEntity: 'expense',
    sourceId: expense._id,
    lines: [
      { account: '1000', debit: round2(expense.amount) },
      { account: expenseAccountFor(expense.category), credit: round2(expense.amount) },
    ],
    actor,
  });

// Fleet net-15 collection (05-finance/accounting.md's AR workflow, 02-intelligence/
// analytics.md's AR Aging report). A fleet-invoice checkout only ever debited Accounts
// Receivable (1100) — nothing in this app previously modeled the cash actually arriving, so
// every fleet invoice would have sat in "outstanding" forever with no way to age out. This is
// the other half of that entry: cash in, AR cleared, for the exact amount originally billed.
const postFleetInvoiceCollection = async (order, actor) =>
  postEntry({
    memo: `Fleet invoice collected: ${order.orderNumber}`,
    sourceEntity: 'wash_order',
    sourceId: order._id,
    lines: [
      { account: '1000', debit: round2(Number(order.price)) },
      { account: '1100', credit: round2(Number(order.price)) },
    ],
    actor,
  });

module.exports = { postEntry, postWashOrderCheckout, postMembershipCharge, postExpense, reverseExpense, postFleetInvoiceCollection, TAX_RATE };
