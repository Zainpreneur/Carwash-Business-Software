const asyncHandler = require('express-async-handler');
const { eq, desc, and, gte, lte, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { ledgerAccounts, journalEntries, journalLines } = require('../db/schema');

// Accounts carry a debit-normal or credit-normal balance depending on type (05-finance/
// accounting.md's chart of accounts) — assets/expenses grow with debits, liabilities/
// equity/revenue grow with credits. Reported as a single "natural positive" balance either
// way so the UI never has to reason about sign conventions.
const DEBIT_NORMAL_TYPES = ['asset', 'expense'];

// `to` arrives as a plain "YYYY-MM-DD" from an HTML date input (Finance.jsx) — parsed as-is
// that's midnight UTC at the *start* of that day, which would silently exclude every entry
// posted later that same day (i.e. almost always today's own entries). Bump it to the end
// of that calendar day so "to: today" actually includes today.
const endOfDay = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await db.select().from(ledgerAccounts).orderBy(ledgerAccounts.code);
  const lines = await db
    .select({ account: journalLines.account, debit: journalLines.debit, credit: journalLines.credit })
    .from(journalLines);

  const totals = new Map();
  for (const l of lines) {
    const t = totals.get(l.account) || { debit: 0, credit: 0 };
    t.debit += Number(l.debit);
    t.credit += Number(l.credit);
    totals.set(l.account, t);
  }

  res.json(
    accounts.map((a) => {
      const t = totals.get(a.code) || { debit: 0, credit: 0 };
      const balance = DEBIT_NORMAL_TYPES.includes(a.type) ? t.debit - t.credit : t.credit - t.debit;
      return { ...a, debitTotal: t.debit, creditTotal: t.credit, balance: Math.round(balance * 100) / 100 };
    })
  );
});

const getEntries = asyncHandler(async (req, res) => {
  const { from, to, sourceEntity, account, page = 1, limit = 25 } = req.query;
  const filters = [];
  if (from) filters.push(gte(journalEntries.postedAt, new Date(from)));
  if (to) filters.push(lte(journalEntries.postedAt, endOfDay(to)));
  if (sourceEntity) filters.push(eq(journalEntries.sourceEntity, sourceEntity));

  let entryIds = null;
  if (account) {
    const rows = await db.select({ entry: journalLines.entry }).from(journalLines).where(eq(journalLines.account, account));
    entryIds = rows.map((r) => r.entry);
    if (!entryIds.length) return res.json({ data: [], total: 0, page: Number(page), pages: 0 });
    filters.push(inArray(journalEntries._id, entryIds));
  }

  const where = filters.length ? and(...filters) : undefined;
  const entries = await db
    .select()
    .from(journalEntries)
    .where(where)
    .orderBy(desc(journalEntries.postedAt))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));

  const allLines = entries.length
    ? await db
        .select({
          entry: journalLines.entry,
          account: journalLines.account,
          accountName: ledgerAccounts.name,
          debit: journalLines.debit,
          credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(ledgerAccounts, eq(journalLines.account, ledgerAccounts.code))
        .where(
          inArray(
            journalLines.entry,
            entries.map((e) => e._id)
          )
        )
    : [];

  const data = entries.map((e) => ({ ...e, lines: allLines.filter((l) => l.entry === e._id) }));
  res.json({ data, total: data.length, page: Number(page) });
});

// Simple P&L over a date range: revenue accounts credited, expense accounts debited, net
// income is the difference. Not a full income statement (no COGS/operating split beyond the
// chart of accounts' own categories) — sized for a single-location business the same way
// the chart of accounts itself is.
const getPnl = asyncHandler(async (req, res) => {
  const now = new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = req.query.to ? endOfDay(req.query.to) : now;

  const accounts = await db.select().from(ledgerAccounts).where(inArray(ledgerAccounts.type, ['revenue', 'expense']));
  const lines = await db
    .select({ account: journalLines.account, debit: journalLines.debit, credit: journalLines.credit })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entry, journalEntries._id))
    .where(and(gte(journalEntries.postedAt, from), lte(journalEntries.postedAt, to)));

  const totals = new Map();
  for (const l of lines) {
    const t = totals.get(l.account) || { debit: 0, credit: 0 };
    t.debit += Number(l.debit);
    t.credit += Number(l.credit);
    totals.set(l.account, t);
  }

  const revenue = [];
  const expense = [];
  for (const a of accounts) {
    const t = totals.get(a.code) || { debit: 0, credit: 0 };
    if (a.type === 'revenue') {
      const amount = Math.round((t.credit - t.debit) * 100) / 100;
      if (amount) revenue.push({ code: a.code, name: a.name, amount });
    } else {
      const amount = Math.round((t.debit - t.credit) * 100) / 100;
      if (amount) expense.push({ code: a.code, name: a.name, amount });
    }
  }

  const totalRevenue = Math.round(revenue.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const totalExpense = Math.round(expense.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  res.json({
    from,
    to,
    revenue,
    expense,
    totalRevenue,
    totalExpense,
    netIncome: Math.round((totalRevenue - totalExpense) * 100) / 100,
  });
});

module.exports = { getAccounts, getEntries, getPnl };
