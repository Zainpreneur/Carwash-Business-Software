const asyncHandler = require('express-async-handler');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { payrollRuns, payrollLines, employees } = require('../db/schema');
const { runPayroll } = require('../services/payrollService');

const getPayrollRuns = asyncHandler(async (req, res) => {
  const runs = await db.select().from(payrollRuns).orderBy(desc(payrollRuns.createdAt));
  res.json(runs);
});

const getPayrollRun = asyncHandler(async (req, res) => {
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns._id, req.params.id));
  if (!run) {
    res.status(404);
    throw new Error('Payroll run not found');
  }
  const lines = await db
    .select({
      _id: payrollLines._id,
      employee: { _id: employees._id, name: employees.name, position: employees.position },
      hoursWorked: payrollLines.hoursWorked,
      hourlyRate: payrollLines.hourlyRate,
      wageAmount: payrollLines.wageAmount,
      commissionAmount: payrollLines.commissionAmount,
      totalAmount: payrollLines.totalAmount,
    })
    .from(payrollLines)
    .innerJoin(employees, eq(payrollLines.employee, employees._id))
    .where(eq(payrollLines.payrollRun, run._id));
  res.json({ ...run, lines });
});

const createPayrollRun = asyncHandler(async (req, res) => {
  const { periodStart, periodEnd } = req.body;
  if (!periodStart || !periodEnd) {
    res.status(400);
    throw new Error('periodStart and periodEnd are required');
  }
  try {
    const run = await runPayroll({ periodStart, periodEnd, createdBy: req.user._id });
    res.status(201).json(run);
  } catch (err) {
    res.status(400);
    throw err;
  }
});

module.exports = { getPayrollRuns, getPayrollRun, createPayrollRun };
