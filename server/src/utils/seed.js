require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, pool, db } = require('../config/db');
const { users, customers, vehicles, services, bookings, bookingServices, expenses } = require('../db/schema');

const servicesSeed = [
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
const hash = (pw) => bcrypt.hashSync(pw, 10);

const run = async () => {
  await connectDB();
  console.log('Seeding database...');

  await pool.query(
    'TRUNCATE booking_services, bookings, expenses, vehicles, services, customers, users RESTART IDENTITY CASCADE'
  );

  const insertedUsers = await db
    .insert(users)
    .values([
      { name: 'Admin User', email: 'admin@carwash.com', password: hash('admin123'), role: 'admin', phone: '555-0100', avatarColor: '#2563eb' },
      { name: 'Maria Manager', email: 'manager@carwash.com', password: hash('manager123'), role: 'manager', phone: '555-0101', avatarColor: '#7c3aed' },
      { name: 'John Staff', email: 'john@carwash.com', password: hash('staff123'), role: 'staff', phone: '555-0102', avatarColor: '#0891b2' },
      { name: 'Sara Staff', email: 'sara@carwash.com', password: hash('staff123'), role: 'staff', phone: '555-0103', avatarColor: '#ea580c' },
      { name: 'Mike Staff', email: 'mike@carwash.com', password: hash('staff123'), role: 'staff', phone: '555-0104', avatarColor: '#16a34a' },
    ])
    .returning();

  const admin = insertedUsers[0];
  const staffMembers = insertedUsers.slice(2);

  const createdServices = await db.insert(services).values(servicesSeed).returning();

  const customerNames = [
    'James Wilson', 'Emma Davis', 'Liam Johnson', 'Olivia Brown', 'Noah Miller',
    'Ava Garcia', 'Ethan Martinez', 'Sophia Anderson', 'Mason Taylor', 'Isabella Thomas',
    'Lucas White', 'Mia Harris', 'Benjamin Clark', 'Charlotte Lewis', 'Henry Walker',
  ];

  const createdCustomers = await db
    .insert(customers)
    .values(
      customerNames.map((name, i) => ({
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        phone: `555-02${String(i).padStart(2, '0')}`,
        address: `${100 + i} Main St, Springfield`,
        loyaltyPoints: Math.floor(Math.random() * 200),
      }))
    )
    .returning();

  const makes = [
    ['Toyota', 'Camry'], ['Honda', 'Civic'], ['Ford', 'F-150'], ['Tesla', 'Model 3'],
    ['BMW', 'X5'], ['Chevrolet', 'Silverado'], ['Nissan', 'Altima'], ['Jeep', 'Wrangler'],
  ];
  const vehicleTypes = ['sedan', 'suv', 'truck', 'van'];
  const colors = ['White', 'Black', 'Silver', 'Blue', 'Red', 'Gray'];

  const vehicleRows = [];
  for (const customer of createdCustomers) {
    const numVehicles = Math.random() > 0.7 ? 2 : 1;
    for (let i = 0; i < numVehicles; i++) {
      const [make, model] = randomFrom(makes);
      vehicleRows.push({
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
  const createdVehicles = await db.insert(vehicles).values(vehicleRows).returning();

  const statuses = ['pending', 'confirmed', 'in-progress', 'completed', 'completed', 'completed', 'cancelled'];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const vehicle = randomFrom(createdVehicles);
    const numServices = 1 + Math.floor(Math.random() * 2);
    const chosen = [];
    for (let j = 0; j < numServices; j++) {
      const s = randomFrom(createdServices);
      if (!chosen.find((cs) => cs._id === s._id)) chosen.push(s);
    }
    const items = chosen.map((s) => ({ service: s._id, name: s.name, price: s.price }));
    const subtotal = items.reduce((sum, s) => sum + s.price, 0);
    const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.1) : 0;
    const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    const daysOffset = Math.floor(Math.random() * 30) - 20;
    const scheduledAt = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    const status = randomFrom(statuses);

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `CW${scheduledAt.getFullYear()}${String(scheduledAt.getMonth() + 1).padStart(2, '0')}${String(scheduledAt.getDate()).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
        customer: vehicle.customer,
        vehicle: vehicle._id,
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
      })
      .returning();

    await db.insert(bookingServices).values(
      items.map((item, pos) => ({
        booking: booking._id,
        service: item.service,
        name: item.name,
        price: item.price,
        position: pos,
      }))
    );
  }

  const expenseCategories = ['supplies', 'utilities', 'salaries', 'maintenance', 'rent', 'marketing'];
  const expenseRows = [];
  for (let i = 0; i < 20; i++) {
    const daysOffset = Math.floor(Math.random() * 30);
    expenseRows.push({
      category: randomFrom(expenseCategories),
      description: `Expense entry #${i + 1}`,
      amount: Math.round((50 + Math.random() * 500) * 100) / 100,
      date: new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000),
      createdBy: admin._id,
    });
  }
  await db.insert(expenses).values(expenseRows);

  console.log('Seed complete!');
  console.log('---------------------------------');
  console.log('Admin login:   admin@carwash.com / admin123');
  console.log('Manager login: manager@carwash.com / manager123');
  console.log('Staff login:   john@carwash.com / staff123');
  console.log('---------------------------------');

  await pool.end();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
