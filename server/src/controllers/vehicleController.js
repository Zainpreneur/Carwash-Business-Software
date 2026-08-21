const asyncHandler = require('express-async-handler');
const Vehicle = require('../models/Vehicle');

const getVehicles = asyncHandler(async (req, res) => {
  const { customer, search } = req.query;
  const query = {};
  if (customer) query.customer = customer;
  if (search) query.plateNumber = { $regex: search, $options: 'i' };
  const vehicles = await Vehicle.find(query).populate('customer', 'name phone').sort({ createdAt: -1 });
  res.json(vehicles);
});

const getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).populate('customer', 'name phone email');
  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  res.json(vehicle);
});

const createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.create(req.body);
  res.status(201).json(vehicle);
});

const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  res.json(vehicle);
});

const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }
  await vehicle.deleteOne();
  res.json({ message: 'Vehicle removed' });
});

module.exports = { getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle };
