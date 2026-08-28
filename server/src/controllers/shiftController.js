const asyncHandler = require('express-async-handler');
const { eq, and, gte, lte, or, lt, gt, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { shifts, employees, serviceBays, leaveRequests } = require('../db/schema');

const listSelect = {
  _id: shifts._id,
  employee: { _id: employees._id, name: employees.name, position: employees.position },
  bay: { _id: serviceBays._id, bayNumber: serviceBays.bayNumber },
  startsAt: shifts.startsAt,
  endsAt: shifts.endsAt,
  status: shifts.status,
  checkedInAt: shifts.checkedInAt,
  checkedOutAt: shifts.checkedOutAt,
  createdAt: shifts.createdAt,
};

const baseQuery = () =>
  db
    .select(listSelect)
    .from(shifts)
    .innerJoin(employees, eq(shifts.employee, employees._id))
    .leftJoin(serviceBays, eq(shifts.bay, serviceBays._id));

// A shift is "late" (the spec's shift-no-show-alert signal) if its start has passed by more
// than 15 minutes with no clock-in yet and it hasn't been marked otherwise — computed live
// on every read, the same pattern ticketController.js's SLA fields use, since this app has
// no scheduler to push the alert proactively.
const LATE_GRACE_MINUTES = 15;
const withLateFlag = (shift) => ({
  ...shift,
  isLate:
    shift.status === 'scheduled' &&
    !shift.checkedInAt &&
    Date.now() - new Date(shift.startsAt).getTime() > LATE_GRACE_MINUTES * 60 * 1000,
});

const getShifts = asyncHandler(async (req, res) => {
  const { employee, from, to } = req.query;
  const filters = [];
  if (employee) filters.push(eq(shifts.employee, employee));
  if (from) filters.push(gte(shifts.startsAt, new Date(from)));
  if (to) filters.push(lte(shifts.startsAt, new Date(to)));

  const rows = await baseQuery()
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(shifts.startsAt));
  res.json(rows.map(withLateFlag));
});

// "request -> site-manager approval -> calendar block ... so Shift scheduling automatically
// respects it" — this app has no calendar integration, so the equivalent guard lives here:
// refuse to create a shift that overlaps an *approved* leave request for the same employee.
const overlapsApprovedLeave = async (employeeId, startsAt, endsAt) => {
  const [conflict] = await db
    .select({ _id: leaveRequests._id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employee, employeeId),
        eq(leaveRequests.status, 'approved'),
        lt(leaveRequests.startDate, endsAt),
        gt(leaveRequests.endDate, startsAt)
      )
    );
  return !!conflict;
};

const createShift = asyncHandler(async (req, res) => {
  const { employee, bay, startsAt, endsAt } = req.body;
  if (!employee || !startsAt || !endsAt) {
    res.status(400);
    throw new Error('employee, startsAt, and endsAt are required');
  }
  if (new Date(startsAt) >= new Date(endsAt)) {
    res.status(400);
    throw new Error('startsAt must be before endsAt');
  }
  if (await overlapsApprovedLeave(employee, new Date(startsAt), new Date(endsAt))) {
    res.status(409);
    throw new Error('This employee has approved leave covering this time window');
  }

  const [created] = await db.insert(shifts).values({ employee, bay: bay || null, startsAt: new Date(startsAt), endsAt: new Date(endsAt) }).returning();
  const [full] = await baseQuery().where(eq(shifts._id, created._id));
  res.status(201).json(withLateFlag(full));
});

const updateShift = asyncHandler(async (req, res) => {
  const allowed = ['bay', 'startsAt', 'endsAt', 'status'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.startsAt) updates.startsAt = new Date(updates.startsAt);
  if (updates.endsAt) updates.endsAt = new Date(updates.endsAt);
  updates.updatedAt = new Date();

  const [updated] = await db.update(shifts).set(updates).where(eq(shifts._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Shift not found');
  }
  const [full] = await baseQuery().where(eq(shifts._id, updated._id));
  res.json(withLateFlag(full));
});

const clockIn = asyncHandler(async (req, res) => {
  const [updated] = await db
    .update(shifts)
    .set({ checkedInAt: new Date(), updatedAt: new Date() })
    .where(eq(shifts._id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404);
    throw new Error('Shift not found');
  }
  const [full] = await baseQuery().where(eq(shifts._id, updated._id));
  res.json(withLateFlag(full));
});

const clockOut = asyncHandler(async (req, res) => {
  const [updated] = await db
    .update(shifts)
    .set({ checkedOutAt: new Date(), status: 'completed', updatedAt: new Date() })
    .where(eq(shifts._id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404);
    throw new Error('Shift not found');
  }
  const [full] = await baseQuery().where(eq(shifts._id, updated._id));
  res.json(withLateFlag(full));
});

const deleteShift = asyncHandler(async (req, res) => {
  const deleted = await db.delete(shifts).where(eq(shifts._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Shift not found');
  }
  res.json({ message: 'Shift removed' });
});

module.exports = { getShifts, createShift, updateShift, clockIn, clockOut, deleteShift };
