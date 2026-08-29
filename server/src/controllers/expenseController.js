const asyncHandler = require('express-async-handler');
const { eq, desc, count, and, gte, lte } = require('drizzle-orm');
const { db } = require('../config/db');
const { expenses, users } = require('../db/schema');
const { postExpense, reverseExpense } = require('../services/ledgerService');

const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page = 1, limit = 20 } = req.query;
  const filters = [];
  if (category) filters.push(eq(expenses.category, category));
  if (from) filters.push(gte(expenses.date, new Date(from)));
  if (to) filters.push(lte(expenses.date, new Date(to)));
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      _id: expenses._id,
      category: expenses.category,
      description: expenses.description,
      amount: expenses.amount,
      date: expenses.date,
      createdBy: { _id: users._id, name: users.name },
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(users, eq(expenses.createdBy, users._id))
    .where(where)
    .orderBy(desc(expenses.date))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));

  const [{ total }] = await db.select({ total: count() }).from(expenses).where(where);
  res.json({ data: rows, total: Number(total), page: Number(page), pages: Math.ceil(Number(total) / Number(limit)) });
});

const createExpense = asyncHandler(async (req, res) => {
  const { category, description, amount, date } = req.body;
  const [expense] = await db
    .insert(expenses)
    .values({ category, description, amount, date: date ? new Date(date) : undefined, createdBy: req.user._id })
    .returning();

  postExpense(expense, { actorType: 'user', actorId: req.user._id }).catch((err) => console.error('[ledger] expense post failed:', err.message));

  res.status(201).json({ ...expense, createdBy: { _id: req.user._id, name: req.user.name } });
});

const updateExpense = asyncHandler(async (req, res) => {
  const allowed = ['category', 'description', 'amount'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.date !== undefined) updates.date = new Date(req.body.date);
  updates.updatedAt = new Date();

  const [expense] = await db.update(expenses).set(updates).where(eq(expenses._id, req.params.id)).returning();
  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }
  res.json(expense);
});

const deleteExpense = asyncHandler(async (req, res) => {
  const deleted = await db.delete(expenses).where(eq(expenses._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Expense not found');
  }
  // Ledger entries are never mutated once posted — a reversing entry, not a deleted/edited
  // line (05-finance/accounting.md's own period-close posture).
  reverseExpense(deleted[0], { actorType: 'user', actorId: req.user._id }).catch((err) => console.error('[ledger] expense reversal post failed:', err.message));
  res.json({ message: 'Expense removed' });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
