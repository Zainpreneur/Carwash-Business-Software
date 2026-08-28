require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, pool, db } = require('../config/db');
const {
  users,
  customers,
  vehicles,
  services,
  bookings,
  bookingServices,
  expenses,
  washPackages,
  packagePricing,
  serviceBays,
  washOrders,
  membershipPlans,
  membershipSubscriptions,
} = require('../db/schema');

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
    'TRUNCATE agent_conversations, membership_subscriptions, membership_plans, customer_messages, wash_orders, package_pricing, wash_packages, service_bays, booking_services, bookings, expenses, vehicles, services, customers, users RESTART IDENTITY CASCADE'
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
        whatsappOptIn: i % 4 !== 0, // a few opted-out customers to exercise the automation gate
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

  // --- SplashPoint wash-floor module (Phase 1 demo data) ---
  const packageSeed = [
    { tier: 'express-exterior', name: 'Express Exterior', deliveryLane: 'tunnel', includesInterior: false, avgCycleTimeMinutes: 8,
      pricing: { 'sedan-coupe': 12, 'suv-truck': 15, 'van-oversized': 18 } },
    { tier: 'exterior-plus', name: 'Exterior Plus', deliveryLane: 'tunnel', includesInterior: false, avgCycleTimeMinutes: 12,
      pricing: { 'sedan-coupe': 20, 'suv-truck': 24, 'van-oversized': 28 } },
    { tier: 'signature-full-service', name: 'Signature Full-Service', deliveryLane: 'detail-bay', includesInterior: true, avgCycleTimeMinutes: 45,
      pricing: { 'sedan-coupe': 45, 'suv-truck': 55, 'van-oversized': 65 } },
    { tier: 'premium-hand-detail', name: 'Premium Hand Detail', deliveryLane: 'detail-bay', includesInterior: true, avgCycleTimeMinutes: 90,
      pricing: { 'sedan-coupe': 90, 'suv-truck': 110, 'van-oversized': 130 } },
  ];
  const createdPackages = await db
    .insert(washPackages)
    .values(packageSeed.map(({ pricing, ...p }) => p))
    .returning();
  await db.insert(packagePricing).values(
    createdPackages.flatMap((pkg, i) =>
      Object.entries(packageSeed[i].pricing).map(([vehicleType, price]) => ({
        package: pkg._id,
        vehicleType,
        price,
      }))
    )
  );

  const bayRows = [
    ...[1, 2, 3, 4].map((n) => ({ bayNumber: n, bayType: 'tunnel-conveyor', operationalStatus: 'operational', avgThroughputPerHour: 12 })),
    ...[5, 6].map((n) => ({ bayNumber: n, bayType: 'detail-bay', operationalStatus: 'operational', avgThroughputPerHour: 1.3 })),
  ];
  const createdBays = await db.insert(serviceBays).values(bayRows).returning();
  const bayByNumber = new Map(createdBays.map((b) => [b.bayNumber, b]));

  // sedan/coupe -> sedan-coupe ; suv/truck -> suv-truck ; van -> van-oversized ;
  // motorcycle/other -> quoted manually (no pricing row), per the spec's assumptions.
  const tierFor = (vehicleType) =>
    ({ sedan: 'sedan-coupe', suv: 'suv-truck', truck: 'suv-truck', van: 'van-oversized' })[vehicleType] || null;
  const priceFor = (pkgIndex, vehicleType) => {
    const tier = tierFor(vehicleType);
    return tier ? packageSeed[pkgIndex].pricing[tier] : 35; // manual-quote fallback for out-of-tier vehicles
  };

  const woDate = (h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const orderNo = (n) =>
    `WO${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(n).padStart(3, '0')}`;

  const wo = (n, overrides) => {
    const vehicle = randomFrom(createdVehicles);
    return {
      orderNumber: orderNo(n),
      customer: vehicle.customer,
      vehicle: vehicle._id,
      bookingType: 'walk-in',
      paymentMethod: randomFrom(['cash', 'card', 'membership']),
      createdBy: admin._id,
      ...overrides,
      price: overrides.price ?? priceFor(overrides.packageIdx, vehicle.type),
    };
  };

  const washOrderSeed = [
    wo(1, { packageIdx: 0, package: createdPackages[0]._id, status: 'queued', queuePosition: 1, queuedAt: woDate(9, 5) }),
    wo(2, { packageIdx: 1, package: createdPackages[1]._id, status: 'queued', queuePosition: 2, queuedAt: woDate(9, 10) }),
    wo(3, { packageIdx: 0, package: createdPackages[0]._id, status: 'bay-assigned', queuePosition: 3, bay: bayByNumber.get(1)._id, queuedAt: woDate(8, 50), bayAssignedAt: woDate(8, 55) }),
    wo(4, { packageIdx: 1, package: createdPackages[1]._id, status: 'in-wash', queuePosition: 4, bay: bayByNumber.get(2)._id, queuedAt: woDate(8, 40), bayAssignedAt: woDate(8, 45), washStartedAt: woDate(8, 47) }),
    wo(5, { packageIdx: 2, package: createdPackages[2]._id, status: 'in-wash', queuePosition: 5, bay: bayByNumber.get(5)._id, bookingType: 'appointment', scheduledFor: woDate(9, 0), queuedAt: woDate(8, 55), bayAssignedAt: woDate(9, 0), washStartedAt: woDate(9, 2) }),
    wo(6, { packageIdx: 0, package: createdPackages[0]._id, status: 'quality-check', queuePosition: 6, bay: bayByNumber.get(3)._id, queuedAt: woDate(8, 30), bayAssignedAt: woDate(8, 33), washStartedAt: woDate(8, 35), washCompletedAt: woDate(8, 43) }),
    wo(7, { packageIdx: 3, package: createdPackages[3]._id, status: 'ready-for-pickup', queuePosition: 7, bay: bayByNumber.get(6)._id, bookingType: 'appointment', scheduledFor: woDate(8, 0), queuedAt: woDate(8, 0), bayAssignedAt: woDate(8, 2), washStartedAt: woDate(8, 5), washCompletedAt: woDate(9, 30), qcResult: 'pass' }),
    wo(8, { packageIdx: 0, package: createdPackages[0]._id, status: 'completed', queuePosition: 8, queuedAt: woDate(7, 40), bayAssignedAt: woDate(7, 42), washStartedAt: woDate(7, 44), washCompletedAt: woDate(7, 52), checkedOutAt: woDate(7, 55), qcResult: 'pass', paymentMethod: 'card' }),
    wo(9, { packageIdx: 1, package: createdPackages[1]._id, status: 'completed', queuePosition: 9, queuedAt: woDate(7, 10), bayAssignedAt: woDate(7, 12), washStartedAt: woDate(7, 14), washCompletedAt: woDate(7, 24), checkedOutAt: woDate(7, 27), qcResult: 'pass', paymentMethod: 'membership' }),
    wo(10, { packageIdx: 0, package: createdPackages[0]._id, status: 'cancelled', queuePosition: 10, queuedAt: woDate(7, 0) }),
  ];
  await db.insert(washOrders).values(washOrderSeed.map(({ packageIdx, ...row }) => row));

  // --- Membership billing (Phase 5 demo data) ---
  // No STRIPE_SECRET_KEY at seed time, so these have no stripePriceId — createPlan/updatePlan
  // will backfill one automatically the next time each plan is saved with Stripe connected.
  const membershipPlanSeed = [
    { tier: 'basic-unlimited', name: 'Basic Unlimited', coveredPackage: createdPackages[0]._id, monthlyPrice: 29, isUnlimited: true, rolloverAllowed: false },
    { tier: 'premium-unlimited', name: 'Premium Unlimited', coveredPackage: createdPackages[1]._id, monthlyPrice: 49, isUnlimited: true, rolloverAllowed: true },
    { tier: 'fleet-unlimited', name: 'Fleet Unlimited', coveredPackage: createdPackages[2]._id, monthlyPrice: 199, isUnlimited: true, washesPerMonthCap: 20, rolloverAllowed: false },
  ];
  const createdPlans = await db.insert(membershipPlans).values(membershipPlanSeed).returning();

  const memberVehicle = createdVehicles[1];
  await db.insert(membershipSubscriptions).values({
    customer: memberVehicle.customer,
    vehicle: memberVehicle._id,
    plan: createdPlans[0]._id,
    billingDayOfMonth: now.getDate(),
    nextBillingDate: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    washesThisCycle: 2,
    status: 'active',
  });

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
