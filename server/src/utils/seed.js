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
  tickets,
  ticketComments,
  ledgerAccounts,
  employees,
  shifts,
  leaveRequests,
  suppliers,
  supplies,
  packageSupplyUsage,
  purchaseOrders,
  purchaseOrderLines,
} = require('../db/schema');
const { postWashOrderCheckout, postMembershipCharge, postExpense } = require('../services/ledgerService');
const { runPayroll } = require('../services/payrollService');
const { receivePurchaseOrder, closePurchaseOrder, postStockAdjustment } = require('../services/inventoryService');
const { createPurchaseOrdersFromRecommendations } = require('../agents/inventoryForecasterAgent');
const { createInquiry } = require('../agents/fleetLeadScorer');
const { logReview } = require('../agents/reviewResponseAgent');

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
    'TRUNCATE reviews, fleet_inquiries, agent_metrics, strategy_recommendations, stock_adjustments, purchase_order_lines, purchase_orders, package_supply_usage, supplies, suppliers, payroll_lines, payroll_runs, leave_requests, shifts, employees, journal_lines, journal_entries, ledger_accounts, ticket_comments, tickets, agent_conversations, membership_subscriptions, membership_plans, customer_messages, wash_orders, package_pricing, wash_packages, service_bays, booking_services, bookings, expenses, vehicles, services, customers, users RESTART IDENTITY CASCADE'
  );

  // --- Chart of accounts (05-finance/accounting.md) — seeded once, up front, since every
  // journal_lines.account_code below (and every real posting from the app itself) requires
  // the account to already exist (a foreign key, not a free-text field).
  const chartOfAccounts = [
    { code: '1000', name: 'Cash', type: 'asset' },
    { code: '1100', name: 'Accounts Receivable - Fleet', type: 'asset' },
    { code: '1400', name: 'Chemical & Supply Inventory', type: 'asset' },
    { code: '1500', name: 'Wash Equipment (net of depreciation)', type: 'asset' },
    { code: '2000', name: 'Supplier Payables', type: 'liability' },
    { code: '2100', name: 'Sales Tax Payable', type: 'liability' },
    { code: '2200', name: 'Loyalty Points Payable', type: 'liability' },
    { code: '2300', name: 'Deferred Membership Revenue', type: 'liability' },
    { code: '2400', name: 'Equipment Financing Payable', type: 'liability' },
    { code: '3000', name: "Owner's Equity", type: 'equity' },
    { code: '4000', name: 'Pay-Per-Wash Revenue', type: 'revenue' },
    { code: '4100', name: 'Membership Revenue', type: 'revenue' },
    { code: '4200', name: 'Fleet/Commercial Revenue', type: 'revenue' },
    { code: '5000', name: 'Payroll Expense', type: 'expense' },
    { code: '5100', name: 'Chemical & Supply Expense', type: 'expense' },
    { code: '5200', name: 'Water & Utilities Expense', type: 'expense' },
    { code: '5300', name: 'Equipment Maintenance Expense', type: 'expense' },
    { code: '5400', name: 'Payment Processing Fees', type: 'expense' },
    { code: '5500', name: 'Marketing Expense', type: 'expense' },
    { code: '5600', name: 'Loyalty Program Expense', type: 'expense' },
    { code: '5700', name: 'Inventory Shrinkage Expense', type: 'expense' },
    { code: '5800', name: 'Rent Expense', type: 'expense' },
  ];
  await db.insert(ledgerAccounts).values(chartOfAccounts);

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

  // Referral program (04-growth/marketing.md) — every customer gets a stable referralCode;
  // Liam Johnson (index 2) is seeded as referred by James Wilson (index 0) to demonstrate
  // the relationship, and Isabella Thomas (index 9) is a fleet account for the
  // Fleet/Commercial segment.
  const referralCodeFor = (name) => `${name.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase()}-SEED`;
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
        referralCode: referralCodeFor(name),
        referredByCode: i === 2 ? referralCodeFor(customerNames[0]) : undefined,
        isFleetAccount: i === 9,
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
  const createdExpenses = await db.insert(expenses).values(expenseRows).returning();
  for (const exp of createdExpenses) await postExpense(exp);

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
    // Detail-bay, completed, assigned to a detail-technician (Sara Staff — see HR seed data
    // below) so payroll's commission calc has something to compute in the demo.
    wo(11, {
      packageIdx: 3, package: createdPackages[3]._id, status: 'completed', queuePosition: 11,
      queuedAt: woDate(6, 0), bayAssignedAt: woDate(6, 2), washStartedAt: woDate(6, 5),
      washCompletedAt: woDate(7, 30), checkedOutAt: woDate(7, 35), qcResult: 'pass',
      paymentMethod: 'card', assignedTechnician: staffMembers[1]._id,
    }),
  ];
  const createdWashOrders = await db.insert(washOrders).values(washOrderSeed.map(({ packageIdx, ...row }) => row)).returning();
  for (const order of createdWashOrders) {
    if (order.status === 'completed') await postWashOrderCheckout(order);
  }

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
  const [createdSubscription] = await db
    .insert(membershipSubscriptions)
    .values({
      customer: memberVehicle.customer,
      vehicle: memberVehicle._id,
      plan: createdPlans[0]._id,
      billingDayOfMonth: now.getDate(),
      nextBillingDate: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
      washesThisCycle: 2,
      status: 'active',
    })
    .returning();
  await postMembershipCharge(createdSubscription, membershipPlanSeed[0].monthlyPrice, 'Basic Unlimited membership charge');

  // A second member, already 2 days into a payment failure — demonstrates
  // membershipBillingAgent.js's lifecycle in the /memberships UI without needing a real
  // Stripe webhook to get there.
  const pastDueVehicle = createdVehicles[2];
  await db.insert(membershipSubscriptions).values({
    customer: pastDueVehicle.customer,
    vehicle: pastDueVehicle._id,
    plan: createdPlans[1]._id,
    billingDayOfMonth: now.getDate(),
    nextBillingDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
    failedPaymentAttempts: 1,
    firstFailedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    status: 'past-due',
  });

  // --- HR & payroll (03-operations/hr.md demo data) ---
  const employeeSeed = [
    { user: staffMembers[0]._id, name: staffMembers[0].name, phone: staffMembers[0].phone, position: 'bay-attendant', status: 'active', hireDate: new Date(now.getFullYear() - 1, 2, 10), hourlyRate: 16 },
    { user: staffMembers[1]._id, name: staffMembers[1].name, phone: staffMembers[1].phone, position: 'detail-technician', status: 'active', hireDate: new Date(now.getFullYear() - 1, 5, 1), hourlyRate: 18, commissionRate: 0.1 },
    { user: staffMembers[2]._id, name: staffMembers[2].name, phone: staffMembers[2].phone, position: 'cashier', status: 'active', hireDate: new Date(now.getFullYear(), 0, 15), hourlyRate: 15 },
    { user: insertedUsers[1]._id, name: insertedUsers[1].name, phone: insertedUsers[1].phone, position: 'site-manager', status: 'active', hireDate: new Date(now.getFullYear() - 2, 0, 1), annualSalary: 62000 },
    // An applicant with no login yet — shows the lifecycle's own point that Employee !=
    // a users/RBAC row.
    { name: 'Jordan Lee', phone: '555-0900', position: 'wash-technician', status: 'applicant' },
  ];
  const createdEmployees = await db.insert(employees).values(employeeSeed).returning();
  const [bayAttendantEmp, detailTechEmp, cashierEmp] = createdEmployees;

  const shiftDate = (daysAgo, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, h, m);
  const shiftSeed = [
    // Completed shifts this pay period — feed payroll's hours calc.
    { employee: bayAttendantEmp._id, startsAt: shiftDate(2, 7), endsAt: shiftDate(2, 15), status: 'completed', checkedInAt: shiftDate(2, 7, 2), checkedOutAt: shiftDate(2, 15) },
    { employee: bayAttendantEmp._id, startsAt: shiftDate(1, 7), endsAt: shiftDate(1, 15), status: 'completed', checkedInAt: shiftDate(1, 7), checkedOutAt: shiftDate(1, 15) },
    { employee: detailTechEmp._id, bay: bayByNumber.get(5)._id, startsAt: shiftDate(2, 8), endsAt: shiftDate(2, 16), status: 'completed', checkedInAt: shiftDate(2, 8), checkedOutAt: shiftDate(2, 16) },
    { employee: cashierEmp._id, startsAt: shiftDate(1, 9), endsAt: shiftDate(1, 17), status: 'completed', checkedInAt: shiftDate(1, 9), checkedOutAt: shiftDate(1, 17) },
    // Scheduled but never clocked in and well past start — demonstrates the live-computed
    // "isLate" flag (shift-no-show-alert's signal) without needing a real scheduler.
    { employee: cashierEmp._id, startsAt: shiftDate(0, 6), endsAt: shiftDate(0, 14), status: 'scheduled' },
    // Upcoming, not yet due.
    { employee: bayAttendantEmp._id, startsAt: new Date(now.getTime() + 20 * 60 * 60 * 1000), endsAt: new Date(now.getTime() + 28 * 60 * 60 * 1000), status: 'scheduled' },
  ];
  await db.insert(shifts).values(shiftSeed);

  await db.insert(leaveRequests).values([
    { employee: cashierEmp._id, startDate: new Date(now.getFullYear(), now.getMonth() + 1, 3), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 5), reason: 'Family trip', status: 'approved', approvedBy: admin._id },
    { employee: bayAttendantEmp._id, startDate: new Date(now.getFullYear(), now.getMonth() + 1, 10), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 10), reason: 'Doctor appointment', status: 'pending' },
  ]);

  // One payroll run over the last 14 days — auto-posts to the ledger too (payrollLinked),
  // so /finance and /hr agree on the same numbers out of the box.
  await runPayroll({
    periodStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    periodEnd: now,
    createdBy: admin._id,
  });

  // --- Inventory & purchasing (03-operations/inventory.md demo data) ---
  const supplierSeed = [
    { name: 'Regional Car Wash Chemical Supply Co.', leadTimeDays: 4 },
    { name: 'Tunnel Equipment Parts Distributor', leadTimeDays: 10 },
    { name: 'Microfiber & Detailing Supplies Wholesaler', leadTimeDays: 5 },
  ];
  const createdSuppliers = await db.insert(suppliers).values(supplierSeed).returning();
  const [chemSupplier, partsSupplier, towelsSupplier] = createdSuppliers;

  // Deliberately low on-hand for tunnel-soap and interior-cleaner — this seed's wash-floor
  // demo data only has a handful of *completed* orders (not a realistic week's volume), so
  // the reorder-point math below works out to small numbers by design, just enough to
  // demonstrate inventory-forecaster actually flagging something without needing hundreds
  // of fabricated historical wash orders.
  const supplySeed = [
    { name: 'Tunnel Soap Concentrate', warehouse: 'main-chemical-room', unit: 'gallon', quantityOnHand: 0.05, unitCost: 12, supplier: chemSupplier._id },
    { name: 'Wax Concentrate', warehouse: 'main-chemical-room', unit: 'gallon', quantityOnHand: 40, unitCost: 18, supplier: chemSupplier._id },
    { name: 'Tire Shine', warehouse: 'main-chemical-room', unit: 'gallon', quantityOnHand: 30, unitCost: 15, supplier: chemSupplier._id },
    { name: 'Reclaim Filter Media', warehouse: 'main-chemical-room', unit: 'case', quantityOnHand: 10, unitCost: 45, supplier: partsSupplier._id },
    { name: 'Interior Cleaner', warehouse: 'detail-bay-storage', unit: 'gallon', quantityOnHand: 0.1, unitCost: 20, supplier: chemSupplier._id },
    { name: 'Microfiber Towels', warehouse: 'detail-bay-storage', unit: 'case', quantityOnHand: 8, unitCost: 35, supplier: towelsSupplier._id },
  ];
  const createdSupplies = await db.insert(supplies).values(supplySeed).returning();
  const [soap, wax, tireShine, filterMedia, interiorCleaner, towels] = createdSupplies;

  // "Chemical consumption scales with package mix, not just wash count."
  await db.insert(packageSupplyUsage).values([
    { package: createdPackages[0]._id, supply: soap._id, quantityPerWash: 0.1 }, // express-exterior
    { package: createdPackages[1]._id, supply: soap._id, quantityPerWash: 0.12 }, // exterior-plus
    { package: createdPackages[1]._id, supply: wax._id, quantityPerWash: 0.05 },
    { package: createdPackages[1]._id, supply: tireShine._id, quantityPerWash: 0.03 },
    { package: createdPackages[2]._id, supply: wax._id, quantityPerWash: 0.08 }, // signature-full-service
    { package: createdPackages[2]._id, supply: interiorCleaner._id, quantityPerWash: 0.15 },
    { package: createdPackages[2]._id, supply: towels._id, quantityPerWash: 0.02 },
    { package: createdPackages[3]._id, supply: wax._id, quantityPerWash: 0.1 }, // premium-hand-detail
    { package: createdPackages[3]._id, supply: interiorCleaner._id, quantityPerWash: 0.25 },
    { package: createdPackages[3]._id, supply: towels._id, quantityPerWash: 0.05 },
  ]);

  // A stock write-off — approved by the site-manager Employee record, posts to 5700
  // Inventory Shrinkage Expense.
  await postStockAdjustment({
    supply: tireShine._id,
    quantityDelta: -2,
    reasonCode: 'spillage',
    notes: 'Dropped case during restock',
    approvedBy: createdEmployees[3]._id, // Maria Manager, site-manager
    createdBy: admin._id,
  });

  // A purchase order taken all the way through Sent -> Received -> Closed, so the ledger
  // (and the /inventory UI) show a complete example, not just a draft.
  const [filterPO] = await db
    .insert(purchaseOrders)
    .values({ supplier: partsSupplier._id, status: 'sent', totalAmount: 5 * filterMedia.unitCost, source: 'manual', createdBy: admin._id, sentAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) })
    .returning();
  const [filterPOLine] = await db
    .insert(purchaseOrderLines)
    .values({ purchaseOrder: filterPO._id, supply: filterMedia._id, quantityOrdered: 5, unitCost: filterMedia.unitCost })
    .returning();
  await receivePurchaseOrder({ purchaseOrderId: filterPO._id, receivedLines: [{ lineId: filterPOLine._id, quantityReceived: 5 }] });
  await closePurchaseOrder(filterPO._id);

  // inventory-forecaster's own recommendation run — drafts/sends real POs from the
  // deliberately-low soap/interior-cleaner stock above, exactly as POST /inventory/forecast/run
  // would.
  await createPurchaseOrdersFromRecommendations(admin._id);

  // --- Support tickets (04-growth/crm.md demo data) ---
  const ticketSeed = [
    {
      customer: createdCustomers[0]._id,
      subject: 'Scratch on rear bumper after wash',
      category: 'damage-claim',
      priority: 'high',
      status: 'open',
      description: 'Customer noticed a scratch at pickup, wants it looked at.',
      source: 'in-app',
      createdBy: admin._id,
    },
    {
      customer: createdCustomers[1]._id,
      subject: 'Charged twice for membership this month',
      category: 'billing-dispute',
      priority: 'normal',
      status: 'in-progress',
      description: 'Two charges on the same card on the same day.',
      source: 'whatsapp',
      assignedTo: staffMembers[0]._id,
      firstRespondedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      createdBy: admin._id,
    },
    {
      customer: createdCustomers[2]._id,
      subject: 'Interior still had crumbs after Signature wash',
      category: 'quality-complaint',
      priority: 'normal',
      status: 'resolved',
      description: 'Requested a free rework, completed same day.',
      source: 'whatsapp',
      assignedTo: staffMembers[1]._id,
      firstRespondedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      createdBy: admin._id,
    },
  ];
  const createdTickets = await db.insert(tickets).values(ticketSeed).returning();
  await db.insert(ticketComments).values([
    {
      ticket: createdTickets[1]._id,
      author: staffMembers[0]._id,
      authorType: 'staff',
      body: 'Looked into it — one charge was a pending auth that already dropped off. Confirming with customer.',
    },
    {
      ticket: createdTickets[2]._id,
      author: staffMembers[1]._id,
      authorType: 'system',
      body: 'Status changed: in-progress → resolved',
    },
  ]);

  // --- Growth cluster (04-growth/marketing.md demo data) ---
  await createInquiry({
    companyName: 'Springfield Delivery Co.',
    contactPhone: '555-0700',
    vehicleCountRequested: 12,
    contactPattern: 'business-hours',
    invoicingTermsRequested: true,
    createdBy: admin._id,
  }); // scores hot — demonstrates the >=50 auto-flag threshold
  await createInquiry({
    companyName: 'Miller Landscaping',
    contactPhone: '555-0701',
    vehicleCountRequested: 3,
    contactPattern: 'after-hours',
    invoicingTermsRequested: false,
    createdBy: admin._id,
  }); // scores well under the hot-lead threshold

  await logReview({ customer: createdCustomers[3]._id, source: 'google-business-profile', rating: 5, text: 'Fast, friendly, and my car looks brand new every time!', loggedBy: admin._id });
  await logReview({ customer: createdCustomers[4]._id, source: 'google-business-profile', rating: 2, text: 'There was a scratch on my bumper after the wash that wasn\'t there before.', loggedBy: admin._id });

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
