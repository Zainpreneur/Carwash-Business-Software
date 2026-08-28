const asyncHandler = require('express-async-handler');
const { eq, and, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { leaveRequests, employees } = require('../db/schema');
const { notifyRoles } = require('../utils/notify');

const listSelect = {
  _id: leaveRequests._id,
  employee: { _id: employees._id, name: employees.name, position: employees.position },
  startDate: leaveRequests.startDate,
  endDate: leaveRequests.endDate,
  reason: leaveRequests.reason,
  status: leaveRequests.status,
  createdAt: leaveRequests.createdAt,
};

const getLeaveRequests = asyncHandler(async (req, res) => {
  const { employee, status } = req.query;
  const filters = [];
  if (employee) filters.push(eq(leaveRequests.employee, employee));
  if (status) filters.push(eq(leaveRequests.status, status));

  const rows = await db
    .select(listSelect)
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employee, employees._id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(leaveRequests.createdAt));
  res.json(rows);
});

const createLeaveRequest = asyncHandler(async (req, res) => {
  const { employee, startDate, endDate, reason } = req.body;
  if (!employee || !startDate || !endDate) {
    res.status(400);
    throw new Error('employee, startDate, and endDate are required');
  }
  if (new Date(startDate) > new Date(endDate)) {
    res.status(400);
    throw new Error('startDate must be before endDate');
  }
  const [created] = await db
    .insert(leaveRequests)
    .values({ employee, startDate: new Date(startDate), endDate: new Date(endDate), reason })
    .returning();

  notifyRoles(
    ['admin', 'manager'],
    { type: 'leave_requested', title: 'Leave request', message: `New leave request pending approval` },
    req.user._id
  ).catch(() => {});

  res.status(201).json(created);
});

// site-manager approval per the spec's own workflow — admin/manager only (route-gated).
const decideLeaveRequest = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'denied'].includes(status)) {
    res.status(400);
    throw new Error('status must be "approved" or "denied"');
  }
  const [updated] = await db
    .update(leaveRequests)
    .set({ status, approvedBy: req.user._id, updatedAt: new Date() })
    .where(eq(leaveRequests._id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404);
    throw new Error('Leave request not found');
  }
  res.json(updated);
});

module.exports = { getLeaveRequests, createLeaveRequest, decideLeaveRequest };
