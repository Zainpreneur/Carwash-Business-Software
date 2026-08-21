const asyncHandler = require('express-async-handler');
const Expense = require('../models/Expense');

const getExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, page = 1, limit = 20 } = req.query;
  const query = {};
  if (category) query.category = category;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [expenses, total] = await Promise.all([
    Expense.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)).populate('createdBy', 'name'),
    Expense.countDocuments(query),
  ]);
  res.json({ data: expenses, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json(expense);
});

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }
  res.json(expense);
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }
  await expense.deleteOne();
  res.json({ message: 'Expense removed' });
});

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
