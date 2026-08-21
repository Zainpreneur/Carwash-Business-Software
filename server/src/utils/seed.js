require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Expense = require('../models/Expense');

const services = [
  { name: 'Express Wash', category: 'basic', price: 15, durationMinutes: 20, description: 'Quick exterior rinse & dry' },
  { name: 'Standard Wash & Vacuum', category: 'basic', price: 25, durationMinutes: 35, description: 'Exterior wash with interior vacuum' },
  { name: 'Deluxe Wash', category: 'premium', price: 40, durationMinutes: 50, description: 'Wash, wax, tire shine & vacuum' },
  { name: 'Full Detailing', category: 'detailing', price: 120, durationMinutes: 150, description: 'Complete interior & exterior detailing' },
  { name: 'Interior Deep Clean', category: 'detailing', price: 70, durationMinutes: 90, description: 'Deep upholstery & carpet cleaning' },
  { name: 'Wax & Polish', category: 'addon', price: 30, durationMinutes: 40, description: 'Hand wax and paint polish' },
  { name: 'Engine Bay Cleaning', category: 'addon', price: 20, durationMinutes: 25, description: 'Degrease and clean engine bay' },
  { name: 'Ceramic Coating', category: 'premium', price: 200, durationMinutes: 180, description: 'Long-lasting ceramic paint protection' },
];

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const run = async () => {
  await connectDB();
  console.log('Seeding database...');

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Vehicle.deleteMany({}),
    Service.deleteMany({}),
    Booking.deleteMany({}),
    Expense.deleteMany({}),
  ]);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@carwash.com',
    password: 'admin123',
    role: 'admin',
    phone: '555-0100',
    avatarColor: '#2563eb',
  });

  const manager = await User.create({
    name: 'Maria Manager',
    email: 'manager@carwash.com',
    password: 'manager123',
    role: 'manager',
    phone: '555-0101',
    avatarColor: '#7c3aed',
  });

  const staffMembers = await User.insertMany([
    { name: 'John Staff', email: 'john@carwash.com', password: 'staff123', role: 'staff', phone: '555-0102', avatarColor: '#0891b2' },
    { name: 'Sara Staff', email: 'sara@carwash.com', password: 'staff123', role: 'staff', phone: '555-0103', avatarColor: '#ea580c' },
    { name: 'Mike Staff', email: 'mike@carwash.com', password: 'staff123', role: 'staff', phone: '555-0104', avatarColor: '#16a34a' },
  ]);

  const createdServices = await Service.insertMany(services);

  const customerNames = [
    'James Wilson', 'Emma Davis', 'Liam Johnson', 'Olivia Brown', 'Noah Miller',
    'Ava Garcia', 'Ethan Martinez', 'Sophia Anderson', 'Mason Taylor', 'Isabella Thomas',
    'Lucas White', 'Mia Harris', 'Benjamin Clark', 'Charlotte Lewis', 'Henry Walker',
  ];

  const customers = await Customer.insertMany(
    customerNames.map((name, i) => ({
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      phone: `555-02${String(i).padStart(2, '0')}`,
      address: `${100 + i} Main St, Springfield`,
      loyaltyPoints: Math.floor(Math.random() * 200),
    }))
  );

  const makes = [
    ['Toyota', 'Camry'], ['Honda', 'Civic'], ['Ford', 'F-150'], ['Tesla', 'Model 3'],
    ['BMW', 'X5'], ['Chevrolet', 'Silverado'], ['Nissan', 'Altima'], ['Jeep', 'Wrangler'],
  ];
  const vehicleTypes = ['sedan', 'suv', 'truck', 'van'];
  const colors = ['White', 'Black', 'Silver', 'Blue', 'Red', 'Gray'];

  const vehicles = [];
  for (const customer of customers) {
    const numVehicles = Math.random() > 0.7 ? 2 : 1;
    for (let i = 0; i < numVehicles; i++) {
      const [make, model] = randomFrom(makes);
      vehicles.push({
        customer: customer._id,
        make,
        model,
        year: 2015 + Math.floor(Math.random() * 10),
        color: randomFrom(colors),
        plateNumber: `${randomFrom(['ABC', 'XYZ', 'LMN', 'QRS'])}-${1000 + Math.floor(Math.random() * 9000)}`,
        type: randomFrom(vehicleTypes),
      });
    }
  }
  const createdVehicles = await Vehicle.insertMany(vehicles);

  const statuses = ['pending', 'confirmed', 'in-progress', 'completed', 'completed', 'completed', 'cancelled'];
  const bookings = [];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const vehicle = randomFrom(createdVehicles);
    const numServices = 1 + Math.floor(Math.random() * 2);
    const chosenServices = [];
    for (let j = 0; j < numServices; j++) {
      const s = randomFrom(createdServices);
      if (!chosenServices.find((cs) => cs.service.toString() === s._id.toString())) {
        chosenServices.push({ service: s._id, name: s.name, price: s.price });
      }
    }
    const subtotal = chosenServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.1) : 0;
    const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    const daysOffset = Math.floor(Math.random() * 30) - 20;
    const scheduledAt = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    const status = randomFrom(statuses);

    bookings.push({
      bookingNumber: `CW${scheduledAt.getFullYear()}${String(scheduledAt.getMonth() + 1).padStart(2, '0')}${String(scheduledAt.getDate()).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
      customer: vehicle.customer,
      vehicle: vehicle._id,
      services: chosenServices,
      assignedStaff: randomFrom(staffMembers)._id,
      scheduledAt,
      status,
      subtotal,
      discount,
      tax,
      total,
      paymentStatus: status === 'completed' ? 'paid' : 'unpaid',
      paymentMethod: randomFrom(['cash', 'card', 'mobile']),
      createdBy: admin._id,
    });
  }
  await Booking.insertMany(bookings);

  const expenseCategories = ['supplies', 'utilities', 'salaries', 'maintenance', 'rent', 'marketing'];
  const expenses = [];
  for (let i = 0; i < 20; i++) {
    const daysOffset = Math.floor(Math.random() * 30);
    expenses.push({
      category: randomFrom(expenseCategories),
      description: `Expense entry #${i + 1}`,
      amount: Math.round((50 + Math.random() * 500) * 100) / 100,
      date: new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000),
      createdBy: admin._id,
    });
  }
  await Expense.insertMany(expenses);

  console.log('Seed complete!');
  console.log('---------------------------------');
  console.log('Admin login:   admin@carwash.com / admin123');
  console.log('Manager login: manager@carwash.com / manager123');
  console.log('Staff login:   john@carwash.com / staff123');
  console.log('---------------------------------');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
