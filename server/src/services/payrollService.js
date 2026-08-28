// Payroll pipeline (03-operations/hr.md): "sum Shift hours + detail-technician commission
// from WashOrder.assignedTechnicianId for the period -> apply state withholding rules ->
// generate pay records -> post to 5000 Payroll Expense -> disburse via the Stripe payments
// integration -> generate pay-stub documents." Withholding, real Stripe disbursement, and
// pay-stub generation are NOT built (documented, not silently skipped) — this computes and
// posts the accounting side only; it's a paper run, not a real money movement.
const { eq, and, gte, lte, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { employees, shifts, washOrders, washPackages, payrollRuns, payrollLines } = require('../db/schema');
const { postEntry } = require('./ledgerService');

const DEFAULT_COMMISSION_RATE = 0.1; // "10% commission on PackagePricing.price"
const round2 = (n) => Math.round(n * 100) / 100;
const hoursBetween = (start, end) => (new Date(end) - new Date(start)) / (1000 * 60 * 60);

// One line per employee who earned anything this period; employees with nothing worked/paid
// in range are simply omitted rather than posted as a zero row.
const computeLine = async (employee, start, end) => {
  let hoursWorked = 0;
  let wageAmount = 0;
  let commissionAmount = 0;

  if (employee.hourlyRate) {
    const workedShifts = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.employee, employee._id),
          eq(shifts.status, 'completed'),
          gte(shifts.startsAt, start),
          lte(shifts.endsAt, end)
        )
      );
    hoursWorked = round2(workedShifts.reduce((sum, s) => sum + hoursBetween(s.startsAt, s.endsAt), 0));
    wageAmount = round2(hoursWorked * employee.hourlyRate);
  } else if (employee.annualSalary) {
    // payrollCadence: biweekly — 26 pay periods/year.
    wageAmount = round2(employee.annualSalary / 26);
  }

  // Commission tie-back: "the exact same WashOrder.price/PackagePricing.price field the
  // analytics cube's technician-throughput report and the P&L's revenue figure use" — read
  // directly from WashOrder, not a separately-tracked number.
  if (employee.position === 'detail-technician' && employee.user) {
    const completedDetailOrders = await db
      .select({ price: washOrders.price })
      .from(washOrders)
      .innerJoin(washPackages, eq(washOrders.package, washPackages._id))
      .where(
        and(
          eq(washOrders.assignedTechnician, employee.user),
          eq(washPackages.deliveryLane, 'detail-bay'),
          eq(washOrders.status, 'completed'),
          gte(washOrders.checkedOutAt, start),
          lte(washOrders.checkedOutAt, end)
        )
      );
    const rate = employee.commissionRate ?? DEFAULT_COMMISSION_RATE;
    commissionAmount = round2(completedDetailOrders.reduce((sum, o) => sum + Number(o.price) * rate, 0));
  }

  const totalAmount = round2(wageAmount + commissionAmount);
  if (totalAmount <= 0) return null;
  return { employee: employee._id, hoursWorked, hourlyRate: employee.hourlyRate ?? null, wageAmount, commissionAmount, totalAmount };
};

const runPayroll = async ({ periodStart, periodEnd, createdBy }) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (!(start < end)) throw new Error('periodStart must be before periodEnd');

  const activeEmployees = await db.select().from(employees).where(inArray(employees.status, ['active', 'on-leave']));
  const lines = (await Promise.all(activeEmployees.map((e) => computeLine(e, start, end)))).filter(Boolean);
  const totalAmount = round2(lines.reduce((sum, l) => sum + l.totalAmount, 0));

  const [run] = await db.insert(payrollRuns).values({ periodStart: start, periodEnd: end, totalAmount, createdBy }).returning();
  if (lines.length) {
    await db.insert(payrollLines).values(lines.map((l) => ({ ...l, payrollRun: run._id })));
  }

  if (totalAmount > 0) {
    // No accrued-payroll-payable account in the chart — same posture as expenses (debits
    // Cash directly rather than modeling an accounts-payable step this app doesn't have a
    // workflow for elsewhere either).
    await postEntry({
      memo: `Payroll run ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
      sourceEntity: 'payroll_run',
      sourceId: run._id,
      lines: [
        { account: '5000', debit: totalAmount },
        { account: '1000', credit: totalAmount },
      ],
    });
  }

  return { ...run, lines };
};

module.exports = { runPayroll, DEFAULT_COMMISSION_RATE };
