const asyncHandler = require('express-async-handler');
const Service = require('../models/Service');

const getServices = asyncHandler(async (req, res) => {
  const { active, category } = req.query;
  const query = {};
  if (active !== undefined) query.active = active === 'true';
  if (category) query.category = category;
  const services = await Service.find(query).sort({ category: 1, price: 1 });
  res.json(services);
});

const getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json(service);
});

const createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  res.status(201).json(service);
});

const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json(service);
});

const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  await service.deleteOne();
  res.json({ message: 'Service removed' });
});

module.exports = { getServices, getService, createService, updateService, deleteService };
