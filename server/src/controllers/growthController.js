const asyncHandler = require('express-async-handler');
const { desc, eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { fleetInquiries, reviews, customers, users } = require('../db/schema');
const { getSegmentSummary, getAllSegments } = require('../services/segmentService');
const { createInquiry } = require('../agents/fleetLeadScorer');
const { logReview } = require('../agents/reviewResponseAgent');

const segmentSummary = asyncHandler(async (req, res) => res.json(await getSegmentSummary()));

const segmentedCustomers = asyncHandler(async (req, res) => {
  const rows = await getAllSegments();
  const filtered = req.query.segment ? rows.filter((r) => r.segment === req.query.segment) : rows;
  res.json(filtered.map((r) => ({ ...r.customer, segment: r.segment })));
});

const getFleetInquiries = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: fleetInquiries._id,
      customer: { _id: customers._id, name: customers.name },
      companyName: fleetInquiries.companyName,
      contactPhone: fleetInquiries.contactPhone,
      vehicleCountRequested: fleetInquiries.vehicleCountRequested,
      contactPattern: fleetInquiries.contactPattern,
      invoicingTermsRequested: fleetInquiries.invoicingTermsRequested,
      score: fleetInquiries.score,
      status: fleetInquiries.status,
      createdAt: fleetInquiries.createdAt,
    })
    .from(fleetInquiries)
    .leftJoin(customers, eq(fleetInquiries.customer, customers._id))
    .orderBy(desc(fleetInquiries.score), desc(fleetInquiries.createdAt));
  res.json(rows);
});

const createFleetInquiry = asyncHandler(async (req, res) => {
  const { customer, companyName, contactPhone, vehicleCountRequested, contactPattern, invoicingTermsRequested } = req.body;
  if (!companyName || !vehicleCountRequested) {
    res.status(400);
    throw new Error('companyName and vehicleCountRequested are required');
  }
  const created = await createInquiry({
    customer,
    companyName,
    contactPhone,
    vehicleCountRequested: Number(vehicleCountRequested),
    contactPattern: contactPattern || 'business-hours',
    invoicingTermsRequested: !!invoicingTermsRequested,
    createdBy: req.user._id,
  });
  res.status(201).json(created);
});

const updateFleetInquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['new', 'followed-up', 'converted', 'declined'].includes(status)) {
    res.status(400);
    throw new Error('status must be one of new, followed-up, converted, declined');
  }
  const [updated] = await db.update(fleetInquiries).set({ status }).where(eq(fleetInquiries._id, req.params.id)).returning();
  if (!updated) {
    res.status(404);
    throw new Error('Fleet inquiry not found');
  }
  res.json(updated);
});

const getReviews = asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      _id: reviews._id,
      customer: { _id: customers._id, name: customers.name },
      source: reviews.source,
      rating: reviews.rating,
      text: reviews.text,
      status: reviews.status,
      response: reviews.response,
      ticket: reviews.ticket,
      loggedBy: { _id: users._id, name: users.name },
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(customers, eq(reviews.customer, customers._id))
    .leftJoin(users, eq(reviews.loggedBy, users._id))
    .orderBy(desc(reviews.createdAt));
  res.json(rows);
});

const createReview = asyncHandler(async (req, res) => {
  const { customer, source, rating, text } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('rating (1-5) is required');
  }
  const result = await logReview({ customer, source: source || 'manual', rating: Number(rating), text, loggedBy: req.user._id });
  res.status(201).json(result);
});

module.exports = {
  segmentSummary,
  segmentedCustomers,
  getFleetInquiries,
  createFleetInquiry,
  updateFleetInquiryStatus,
  getReviews,
  createReview,
};
