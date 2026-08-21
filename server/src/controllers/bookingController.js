const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

const generateBookingNumber = async () => {
  const today = new Date();
  const prefix = `CW${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const count = await Booking.countDocuments({ bookingNumber: { $regex: `^${prefix}` } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
};

const computeTotals = (services, discount = 0, taxRate = 0) => {
  const subtotal = services.reduce((sum, s) => sum + Number(s.price), 0);
  const discounted = Math.max(subtotal - Number(discount || 0), 0);
  const tax = Math.round(discounted * (Number(taxRate) / 100) * 100) / 100;
  const total = Math.round((discounted + tax) * 100) / 100;
  return { subtotal, tax, total };
};

const getBookings = asyncHandler(async (req, res) => {
  const { status, date, from, to, customer, staff, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (customer) query.customer = customer;
  if (staff) query.assignedStaff = staff;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.scheduledAt = { $gte: start, $lte: end };
  } else if (from || to) {
    query.scheduledAt = {};
    if (from) query.scheduledAt.$gte = new Date(from);
    if (to) query.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('customer', 'name phone')
      .populate('vehicle', 'make model plateNumber type')
      .populate('assignedStaff', 'name')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(query),
  ]);

  res.json({ data: bookings, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('customer')
    .populate('vehicle')
    .populate('assignedStaff', 'name email phone')
    .populate('createdBy', 'name');
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  res.json(booking);
});

const createBooking = asyncHandler(async (req, res) => {
  const { customer, vehicle, serviceIds, assignedStaff, scheduledAt, discount, taxRate, notes, priority } =
    req.body;

  if (!serviceIds || !serviceIds.length) {
    res.status(400);
    throw new Error('At least one service must be selected');
  }

  const services = await Service.find({ _id: { $in: serviceIds } });
  if (!services.length) {
    res.status(400);
    throw new Error('Selected services not found');
  }
  const serviceItems = services.map((s) => ({ service: s._id, name: s.name, price: s.price }));
  const { subtotal, tax, total } = computeTotals(serviceItems, discount, taxRate);

  const bookingNumber = await generateBookingNumber();

  const booking = await Booking.create({
    bookingNumber,
    customer,
    vehicle,
    services: serviceItems,
    assignedStaff: assignedStaff || undefined,
    scheduledAt,
    discount: discount || 0,
    tax,
    subtotal,
    total,
    notes,
    priority,
    createdBy: req.user._id,
  });

  const populated = await Booking.findById(booking._id)
    .populate('customer', 'name phone')
    .populate('vehicle', 'make model plateNumber')
    .populate('assignedStaff', 'name');

  res.status(201).json(populated);
});

const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const { serviceIds, discount, taxRate, assignedStaff, scheduledAt, notes, priority, paymentMethod } =
    req.body;

  if (serviceIds && serviceIds.length) {
    const services = await Service.find({ _id: { $in: serviceIds } });
    booking.services = services.map((s) => ({ service: s._id, name: s.name, price: s.price }));
  }

  const { subtotal, tax, total } = computeTotals(
    booking.services,
    discount !== undefined ? discount : booking.discount,
    taxRate !== undefined ? taxRate : 0
  );
  booking.subtotal = subtotal;
  booking.tax = tax;
  booking.total = total;
  if (discount !== undefined) booking.discount = discount;
  if (assignedStaff !== undefined) booking.assignedStaff = assignedStaff || undefined;
  if (scheduledAt !== undefined) booking.scheduledAt = scheduledAt;
  if (notes !== undefined) booking.notes = notes;
  if (priority !== undefined) booking.priority = priority;
  if (paymentMethod !== undefined) booking.paymentMethod = paymentMethod;

  await booking.save();
  const populated = await Booking.findById(booking._id)
    .populate('customer', 'name phone')
    .populate('vehicle', 'make model plateNumber')
    .populate('assignedStaff', 'name');
  res.json(populated);
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Invalid status value');
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const wasCompleted = booking.status === 'completed';
  booking.status = status;
  await booking.save();

  if (status === 'completed' && !wasCompleted) {
    await Customer.findByIdAndUpdate(booking.customer, {
      $inc: { totalSpent: booking.total, visitCount: 1, loyaltyPoints: Math.floor(booking.total / 10) },
    });
  }

  res.json(booking);
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  if (paymentStatus) booking.paymentStatus = paymentStatus;
  if (paymentMethod) booking.paymentMethod = paymentMethod;
  await booking.save();
  res.json(booking);
});

const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  await booking.deleteOne();
  res.json({ message: 'Booking removed' });
});

module.exports = {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  updateBookingStatus,
  updatePaymentStatus,
  deleteBooking,
};
