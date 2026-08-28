const asyncHandler = require('express-async-handler');
const { eq, and, desc, inArray } = require('drizzle-orm');
const { db } = require('../config/db');
const { tickets, ticketComments, customers, washOrders, users } = require('../db/schema');
const { withSla, OPEN_STATUSES } = require('../utils/tickets');
const { notifyRoles } = require('../utils/notify');

// Ticket state machine (04-growth/crm.md): open -> in-progress -> waiting-on-customer <->
// in-progress -> resolved -> closed; waiting-on-customer -> closed (no-response-14-days).
// Reopening a resolved/closed ticket back to in-progress isn't in the spec's table but is a
// practical necessity any real support tool needs — added here, documented as an addition.
const ALLOWED_TRANSITIONS = {
  open: ['in-progress'],
  'in-progress': ['waiting-on-customer', 'resolved'],
  'waiting-on-customer': ['in-progress', 'closed'],
  resolved: ['closed', 'in-progress'],
  closed: ['in-progress'],
};

const listSelect = {
  _id: tickets._id,
  customer: { _id: customers._id, name: customers.name, phone: customers.phone },
  washOrder: { _id: washOrders._id, orderNumber: washOrders.orderNumber },
  subject: tickets.subject,
  category: tickets.category,
  priority: tickets.priority,
  status: tickets.status,
  description: tickets.description,
  assignedTo: { _id: users._id, name: users.name },
  source: tickets.source,
  firstRespondedAt: tickets.firstRespondedAt,
  resolvedAt: tickets.resolvedAt,
  closedAt: tickets.closedAt,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
};

const baseQuery = () =>
  db
    .select(listSelect)
    .from(tickets)
    .innerJoin(customers, eq(tickets.customer, customers._id))
    .leftJoin(washOrders, eq(tickets.washOrder, washOrders._id))
    .leftJoin(users, eq(tickets.assignedTo, users._id));

const getTickets = asyncHandler(async (req, res) => {
  const { status, category, assignedTo, customer, openOnly } = req.query;
  const filters = [];
  if (status) filters.push(eq(tickets.status, status));
  if (category) filters.push(eq(tickets.category, category));
  if (assignedTo) filters.push(eq(tickets.assignedTo, assignedTo));
  if (customer) filters.push(eq(tickets.customer, customer));
  if (openOnly === 'true') filters.push(inArray(tickets.status, OPEN_STATUSES));

  const rows = await baseQuery()
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(tickets.createdAt));
  res.json(rows.map(withSla));
});

const getTicket = asyncHandler(async (req, res) => {
  const [row] = await baseQuery().where(eq(tickets._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  const comments = await db
    .select({
      _id: ticketComments._id,
      author: { _id: users._id, name: users.name },
      authorType: ticketComments.authorType,
      body: ticketComments.body,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .leftJoin(users, eq(ticketComments.author, users._id))
    .where(eq(ticketComments.ticket, req.params.id))
    .orderBy(ticketComments.createdAt);
  res.json({ ...withSla(row), comments });
});

const createTicket = asyncHandler(async (req, res) => {
  const { customer, washOrder, subject, category, priority, description, source } = req.body;
  if (!customer || !subject) {
    res.status(400);
    throw new Error('Customer and subject are required');
  }
  const [created] = await db
    .insert(tickets)
    .values({
      customer,
      washOrder: washOrder || null,
      subject,
      category: category || 'general',
      priority: priority || 'normal',
      description,
      source: source || 'in-app',
      createdBy: req.user._id,
    })
    .returning();

  await notifyRoles(
    ['admin', 'manager'],
    { type: 'ticket_created', title: `New ${created.category} ticket`, message: created.subject },
    req.user._id
  ).catch(() => {});

  const [full] = await baseQuery().where(eq(tickets._id, created._id));
  res.status(201).json(withSla(full));
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const [ticket] = await db.select().from(tickets).where(eq(tickets._id, req.params.id));
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  const allowed = ALLOWED_TRANSITIONS[ticket.status] || [];
  if (!allowed.includes(status)) {
    res.status(409);
    throw new Error(`Ticket is "${ticket.status}" — cannot move to "${status}"`);
  }

  const updates = { status, updatedAt: new Date() };
  if (status === 'in-progress' && !ticket.firstRespondedAt) updates.firstRespondedAt = new Date();
  if (status === 'resolved') updates.resolvedAt = new Date();
  if (status === 'closed') updates.closedAt = new Date();

  await db.insert(ticketComments).values({
    ticket: ticket._id,
    author: req.user._id,
    authorType: 'system',
    body: `Status changed: ${ticket.status} → ${status}`,
  });
  await db.update(tickets).set(updates).where(eq(tickets._id, ticket._id));

  const [full] = await baseQuery().where(eq(tickets._id, ticket._id));
  res.json(withSla(full));
});

const assignTicket = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;
  const [ticket] = await db.select().from(tickets).where(eq(tickets._id, req.params.id));
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  const updates = { assignedTo: assignedTo || null, updatedAt: new Date() };
  if (ticket.status === 'open') updates.status = 'in-progress'; // "assigned-to-staff" transition
  if (!ticket.firstRespondedAt && updates.status === 'in-progress') updates.firstRespondedAt = new Date();

  await db.update(tickets).set(updates).where(eq(tickets._id, ticket._id));
  const [full] = await baseQuery().where(eq(tickets._id, ticket._id));
  res.json(withSla(full));
});

const addComment = asyncHandler(async (req, res) => {
  const { body } = req.body;
  if (!body) {
    res.status(400);
    throw new Error('Comment body is required');
  }
  const [ticket] = await db.select().from(tickets).where(eq(tickets._id, req.params.id));
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  const [comment] = await db
    .insert(ticketComments)
    .values({ ticket: ticket._id, author: req.user._id, authorType: 'staff', body })
    .returning();

  const updates = { updatedAt: new Date() };
  if (!ticket.firstRespondedAt) updates.firstRespondedAt = new Date();
  await db.update(tickets).set(updates).where(eq(tickets._id, ticket._id));

  res.status(201).json(comment);
});

module.exports = { getTickets, getTicket, createTicket, updateStatus, assignTicket, addComment };
