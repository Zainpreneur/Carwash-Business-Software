const asyncHandler = require('express-async-handler');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../config/db');
const { employees, users } = require('../db/schema');
const { logAudit } = require('../utils/auditLog');

// Employee lifecycle (03-operations/hr.md): Applicant -> Hired -> Onboarding -> Active ->
// On Leave -> Offboarded. Loosely ordered, not strictly enforced like WashOrder/Ticket's
// state machines — real HR moves people back and forth (e.g. Active -> Onboarding after a
// role change) more often than it needs a hard gate.
const POSITIONS = ['bay-attendant', 'wash-technician', 'detail-technician', 'cashier', 'site-manager', 'fleet-account-manager'];
const STATUSES = ['applicant', 'hired', 'onboarding', 'active', 'on-leave', 'offboarded'];

const listSelect = {
  _id: employees._id,
  user: { _id: users._id, name: users.name, email: users.email },
  name: employees.name,
  phone: employees.phone,
  email: employees.email,
  position: employees.position,
  status: employees.status,
  hireDate: employees.hireDate,
  hourlyRate: employees.hourlyRate,
  annualSalary: employees.annualSalary,
  commissionRate: employees.commissionRate,
  emergencyContactName: employees.emergencyContactName,
  emergencyContactPhone: employees.emergencyContactPhone,
  createdAt: employees.createdAt,
  updatedAt: employees.updatedAt,
};

const getEmployees = asyncHandler(async (req, res) => {
  const rows = await db
    .select(listSelect)
    .from(employees)
    .leftJoin(users, eq(employees.user, users._id))
    .orderBy(desc(employees.createdAt));
  res.json(rows);
});

const getEmployee = asyncHandler(async (req, res) => {
  const [row] = await db
    .select(listSelect)
    .from(employees)
    .leftJoin(users, eq(employees.user, users._id))
    .where(eq(employees._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json(row);
});

const createEmployee = asyncHandler(async (req, res) => {
  const { name, position, ...rest } = req.body;
  if (!name || !POSITIONS.includes(position)) {
    res.status(400);
    throw new Error(`name and a valid position (${POSITIONS.join(', ')}) are required`);
  }
  const [created] = await db
    .insert(employees)
    .values({
      name,
      position,
      user: rest.user || null,
      phone: rest.phone,
      email: rest.email,
      status: STATUSES.includes(rest.status) ? rest.status : 'active',
      hireDate: rest.hireDate ? new Date(rest.hireDate) : new Date(),
      hourlyRate: rest.hourlyRate ?? null,
      annualSalary: rest.annualSalary ?? null,
      commissionRate: position === 'detail-technician' ? rest.commissionRate ?? 0.1 : null,
      emergencyContactName: rest.emergencyContactName,
      emergencyContactPhone: rest.emergencyContactPhone,
    })
    .returning();
  logAudit({ entity: 'employee', entityId: created._id, action: 'create', actorType: 'user', actorId: req.user._id, after: created });
  res.status(201).json(created);
});

const updateEmployee = asyncHandler(async (req, res) => {
  const [before] = await db.select().from(employees).where(eq(employees._id, req.params.id));
  const allowed = [
    'user', 'name', 'phone', 'email', 'position', 'status', 'hireDate',
    'hourlyRate', 'annualSalary', 'commissionRate', 'emergencyContactName', 'emergencyContactPhone',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.position && updates.position && !POSITIONS.includes(updates.position)) {
    res.status(400);
    throw new Error(`position must be one of ${POSITIONS.join(', ')}`);
  }
  if (updates.status && !STATUSES.includes(updates.status)) {
    res.status(400);
    throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  }
  if (updates.hireDate) updates.hireDate = new Date(updates.hireDate);
  updates.updatedAt = new Date();

  const [updated] = await db.update(employees).set(updates).where(eq(employees._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Employee not found');
  }
  logAudit({ entity: 'employee', entityId: updated._id, action: 'update', actorType: 'user', actorId: req.user._id, before, after: updated });
  res.json(updated);
});

const deleteEmployee = asyncHandler(async (req, res) => {
  const deleted = await db.delete(employees).where(eq(employees._id, req.params.id)).returning();
  if (!deleted.length) {
    res.status(404);
    throw new Error('Employee not found');
  }
  logAudit({ entity: 'employee', entityId: req.params.id, action: 'delete', actorType: 'user', actorId: req.user._id, before: deleted[0] });
  res.json({ message: 'Employee removed' });
});

module.exports = { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, POSITIONS, STATUSES };
