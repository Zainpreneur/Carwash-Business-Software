require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, client, db } = require('../config/db');
const {
  tenants,
  tenantMembers,
  tenantSubscriptions,
  locations,
  users,
  customers,
  vehicles,
  services,
  bookings,
  bookingServices,
  expenses,
  notifications,
  washPackages,
  packagePricing,
  serviceBays,
  washOrders,
  customerMessages,
  membershipPlans,
  membershipSubscriptions,
  tickets,
  ticketComments,
  employees,
  shifts,
  leaveRequests,
  suppliers,
  supplies,
  locationStock,
  packageSupplyUsage,
  purchaseOrders,
  purchaseOrderLines,
  stockAdjustments,
  saasPlans,
  invites,
  auditLogs,
  tenantDomains,
} = require('../db/schema');
const { runWithTenant, runAsPlatform } = require('../db/tenantDb');
const { syncPlans } = require('../services/plans');
const { createTenant } = require('../services/tenantService');
const { receivePurchaseOrder, closePurchaseOrder, postStockAdjustment } = require('../services/inventoryService');

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

/**
 * Seed one business.
 *
 * Everything below runs inside the tenant's context, so the data layer stamps
 * the business onto every row — exactly like a real signup would.
 */
const seedTenant = async ({ tenant, features, ownerUser, staffRows, locationNames }) => {
  await runWithTenant(tenant._id, async () => {
    const now = new Date();

    // --- People -----------------------------------------------------------
    const createdUsers = await db
      .insert(users)
      .values(
        staffRows.map((s) => ({
          name: s.name,
          email: s.email.toLowerCase(),
          password: hash(s.password),
          phone: s.phone,
          avatarColor: s.avatarColor,
          platformRole: 'user',
        }))
      )
      .returning();

    const byEmail = new Map(createdUsers.map((u) => [u.email, u]));
    // The owner's membership was already created with the business itself.
    await db.insert(tenantMembers).values(
      staffRows.map((s) => ({
        tenant: tenant._id,
        user: byEmail.get(s.email.toLowerCase())._id,
        role: s.role,
        status: 'active',
        scopeAllLocations: true,
      }))
    );

    const owner = ownerUser;
    const managerRow = staffRows.find((s) => s.role === 'manager');
    const manager = managerRow ? byEmail.get(managerRow.email.toLowerCase()) : owner;
    const staff = createdUsers.filter((u) => u._id !== manager._id);
    const anyStaff = staff.length ? staff : [owner];

    // --- Locations (branches) --------------------------------------------
    const createdLocations = await db
      .insert(locations)
      .values(
        locationNames.map((l, i) => ({
          name: l.name,
          code: l.code,
          address: l.address,
          city: l.city,
          country: l.country,
          phone: l.phone,
          timezone: tenant.timezone,
          active: true,
        }))
      )
      .returning();
    const mainLocation = createdLocations[0];

    // --- Wash floor -------------------------------------------------------
    const bayRows = [
      ...[1, 2, 3, 4].map((n) => ({ bayNumber: n, bayType: 'tunnel-conveyor', operationalStatus: 'operational', avgThroughputPerHour: 12, location: mainLocation._id })),
      ...[5, 6].map((n) => ({ bayNumber: n, bayType: 'detail-bay', operationalStatus: 'operational', avgThroughputPerHour: 1.3, location: mainLocation._id })),
    ];
    if (createdLocations[1]) {
      bayRows.push(
        { bayNumber: 1, bayType: 'tunnel-conveyor', operationalStatus: 'operational', avgThroughputPerHour: 10, location: createdLocations[1]._id },
        { bayNumber: 2, bayType: 'tunnel-conveyor', operationalStatus: 'operational', avgThroughputPerHour: 10, location: createdLocations[1]._id }
      );
    }
    const createdBays = await db.insert(serviceBays).values(bayRows).returning();
    const bayByNumber = new Map(createdBays.map((b) => [b.bayNumber, b]));

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

    const createdServices = await db.insert(services).values(servicesSeed.map((s) => ({ ...s }))).returning();

    // --- Customers & vehicles ---------------------------------------------
    const customerNames = [
      'James Wilson', 'Emma Davis', 'Liam Johnson', 'Olivia Brown', 'Noah Miller',
      'Ava Garcia', 'Ethan Martinez', 'Sophia Anderson', 'Mason Taylor', 'Isabella Thomas',
      'Lucas White', 'Mia Harris', 'Benjamin Clark', 'Charlotte Lewis', 'Henry Walker',
    ];
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
          whatsappOptIn: i % 4 !== 0,
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

    // --- Bookings ---------------------------------------------------------
    const statuses = ['pending', 'confirmed', 'in-progress', 'completed', 'completed', 'completed', 'cancelled'];
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
          location: mainLocation._id,
          assignedStaff: randomFrom(anyStaff)._id,
          scheduledAt,
          status,
          subtotal,
          discount,
          tax,
          total,
          paymentStatus: status === 'completed' ? 'paid' : 'unpaid',
          paymentMethod: randomFrom(['cash', 'card', 'mobile']),
          createdBy: owner._id,
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

    // --- Expenses ---------------------------------------------------------
    const expenseCategories = ['supplies', 'utilities', 'salaries', 'maintenance', 'rent', 'marketing'];
    const expenseRows = [];
    for (let i = 0; i < 20; i++) {
      const daysOffset = Math.floor(Math.random() * 30);
      expenseRows.push({
        location: mainLocation._id,
        category: randomFrom(expenseCategories),
        description: `Expense entry #${i + 1}`,
        amount: Math.round((50 + Math.random() * 500) * 100) / 100,
        date: new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000),
        createdBy: owner._id,
      });
    }
    await db.insert(expenses).values(expenseRows);

    // --- Wash orders (the live wash floor) ---------------------------------
    const tierFor = (vehicleType) =>
      ({ sedan: 'sedan-coupe', suv: 'suv-truck', truck: 'suv-truck', van: 'van-oversized' })[vehicleType] || null;
    const priceFor = (pkgIndex, vehicleType) => {
      const tier = tierFor(vehicleType);
      return tier ? packageSeed[pkgIndex].pricing[tier] : 35;
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
        location: mainLocation._id,
        bookingType: 'walk-in',
        paymentMethod: randomFrom(['cash', 'card', 'membership']),
        createdBy: owner._id,
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
      wo(11, {
        packageIdx: 3, package: createdPackages[3]._id, status: 'completed', queuePosition: 11,
        queuedAt: woDate(6, 0), bayAssignedAt: woDate(6, 2), washStartedAt: woDate(6, 5),
        washCompletedAt: woDate(7, 30), checkedOutAt: woDate(7, 35), qcResult: 'pass',
        paymentMethod: 'card', assignedTechnician: staff[1]?._id,
      }),
    ];
    await db.insert(washOrders).values(washOrderSeed.map(({ packageIdx, ...row }) => row));

    // --- Memberships (only on plans that include them) --------------------
    if (features.memberships) {
      const membershipPlanSeed = [
        { tier: 'basic-unlimited', name: 'Basic Unlimited', coveredPackage: createdPackages[0]._id, monthlyPrice: 29, isUnlimited: true, rolloverAllowed: false },
        { tier: 'premium-unlimited', name: 'Premium Unlimited', coveredPackage: createdPackages[1]._id, monthlyPrice: 49, isUnlimited: true, rolloverAllowed: true },
        { tier: 'fleet-unlimited', name: 'Fleet Unlimited', coveredPackage: createdPackages[2]._id, monthlyPrice: 199, isUnlimited: true, washesPerMonthCap: 20, rolloverAllowed: false },
      ];
      const createdPlans = await db.insert(membershipPlans).values(membershipPlanSeed).returning();

      await db.insert(membershipSubscriptions).values({
        customer: createdVehicles[1].customer,
        vehicle: createdVehicles[1]._id,
        plan: createdPlans[0]._id,
        billingDayOfMonth: now.getDate(),
        nextBillingDate: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
        washesThisCycle: 2,
        status: 'active',
      });

      await db.insert(membershipSubscriptions).values({
        customer: createdVehicles[2].customer,
        vehicle: createdVehicles[2]._id,
        plan: createdPlans[1]._id,
        billingDayOfMonth: now.getDate(),
        nextBillingDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
        failedPaymentAttempts: 1,
        firstFailedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: 'past-due',
      });
    }

    // --- HR ---------------------------------------------------------------
    let createdEmployees = [];
    if (features.hr) {
      // A business can have any number of staff, so each crew slot falls back
      // to the next available person (and finally to the owner).
      const crew = [...anyStaff];
      const crewMember = (index) => crew[index % crew.length];

      const employeeSeed = [
        { user: crewMember(0)._id, name: crewMember(0).name, phone: crewMember(0).phone, position: 'bay-attendant', status: 'active', hireDate: new Date(now.getFullYear() - 1, 2, 10), hourlyRate: 16, location: mainLocation._id },
        { user: crewMember(1)._id, name: crewMember(1).name, phone: crewMember(1).phone, position: 'detail-technician', status: 'active', hireDate: new Date(now.getFullYear() - 1, 5, 1), hourlyRate: 18, commissionRate: 0.1, location: mainLocation._id },
        { user: crewMember(2)._id, name: crewMember(2).name, phone: crewMember(2).phone, position: 'cashier', status: 'active', hireDate: new Date(now.getFullYear(), 0, 15), hourlyRate: 15, location: mainLocation._id },
        { user: manager._id, name: manager.name, phone: manager.phone, position: 'site-manager', status: 'active', hireDate: new Date(now.getFullYear() - 2, 0, 1), annualSalary: 62000, location: mainLocation._id },
        { name: 'Jordan Lee', phone: '555-0900', position: 'wash-technician', status: 'applicant', location: mainLocation._id },
      ];
      createdEmployees = await db.insert(employees).values(employeeSeed).returning();
      const [bayAttendantEmp, detailTechEmp, cashierEmp] = createdEmployees;

      const shiftDate = (daysAgo, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, h, m);
      await db.insert(shifts).values([
        { employee: bayAttendantEmp._id, location: mainLocation._id, startsAt: shiftDate(2, 7), endsAt: shiftDate(2, 15), status: 'completed', checkedInAt: shiftDate(2, 7, 2), checkedOutAt: shiftDate(2, 15) },
        { employee: bayAttendantEmp._id, location: mainLocation._id, startsAt: shiftDate(1, 7), endsAt: shiftDate(1, 15), status: 'completed', checkedInAt: shiftDate(1, 7), checkedOutAt: shiftDate(1, 15) },
        { employee: detailTechEmp._id, location: mainLocation._id, bay: bayByNumber.get(5)._id, startsAt: shiftDate(2, 8), endsAt: shiftDate(2, 16), status: 'completed', checkedInAt: shiftDate(2, 8), checkedOutAt: shiftDate(2, 16) },
        { employee: cashierEmp._id, location: mainLocation._id, startsAt: shiftDate(1, 9), endsAt: shiftDate(1, 17), status: 'completed', checkedInAt: shiftDate(1, 9), checkedOutAt: shiftDate(1, 17) },
        { employee: cashierEmp._id, location: mainLocation._id, startsAt: shiftDate(0, 6), endsAt: shiftDate(0, 14), status: 'scheduled' },
        { employee: bayAttendantEmp._id, location: mainLocation._id, startsAt: new Date(now.getTime() + 20 * 60 * 60 * 1000), endsAt: new Date(now.getTime() + 28 * 60 * 60 * 1000), status: 'scheduled' },
      ]);

      await db.insert(leaveRequests).values([
        { employee: cashierEmp._id, startDate: new Date(now.getFullYear(), now.getMonth() + 1, 3), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 5), reason: 'Family trip', status: 'approved', approvedBy: owner._id },
        { employee: bayAttendantEmp._id, startDate: new Date(now.getFullYear(), now.getMonth() + 1, 10), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 10), reason: 'Doctor appointment', status: 'pending' },
      ]);
    }

    // --- Inventory (only on plans that include it) -------------------------
    if (features.inventory) {
      const supplierSeed = [
        { name: 'Regional Car Wash Chemical Supply Co.', leadTimeDays: 4 },
        { name: 'Tunnel Equipment Parts Distributor', leadTimeDays: 10 },
        { name: 'Microfiber & Detailing Supplies Wholesaler', leadTimeDays: 5 },
      ];
      const createdSuppliers = await db.insert(suppliers).values(supplierSeed).returning();
      const [chemSupplier, partsSupplier, towelsSupplier] = createdSuppliers;

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

      // Split the stock across the business's locations.
      const stockRows = [];
      for (const supply of createdSupplies) {
        for (const location of createdLocations) {
          stockRows.push({
            location: location._id,
            supply: supply._id,
            quantityOnHand: Math.round((supply.quantityOnHand / createdLocations.length) * 100) / 100,
          });
        }
      }
      await db.insert(locationStock).values(stockRows);

      await db.insert(packageSupplyUsage).values([
        { package: createdPackages[0]._id, supply: soap._id, quantityPerWash: 0.1 },
        { package: createdPackages[1]._id, supply: soap._id, quantityPerWash: 0.12 },
        { package: createdPackages[1]._id, supply: wax._id, quantityPerWash: 0.05 },
        { package: createdPackages[1]._id, supply: tireShine._id, quantityPerWash: 0.03 },
        { package: createdPackages[2]._id, supply: wax._id, quantityPerWash: 0.08 },
        { package: createdPackages[2]._id, supply: interiorCleaner._id, quantityPerWash: 0.15 },
        { package: createdPackages[2]._id, supply: towels._id, quantityPerWash: 0.02 },
        { package: createdPackages[3]._id, supply: wax._id, quantityPerWash: 0.1 },
        { package: createdPackages[3]._id, supply: interiorCleaner._id, quantityPerWash: 0.25 },
        { package: createdPackages[3]._id, supply: towels._id, quantityPerWash: 0.05 },
      ]);

      if (createdEmployees.length) {
        await postStockAdjustment({
          supply: tireShine._id,
          quantityDelta: -2,
          reasonCode: 'spillage',
          notes: 'Dropped case during restock',
          approvedBy: createdEmployees[3]._id,
          createdBy: owner._id,
          location: mainLocation._id,
        });
      }

      const [filterPO] = await db
        .insert(purchaseOrders)
        .values({
          supplier: partsSupplier._id,
          location: mainLocation._id,
          status: 'sent',
          totalAmount: 5 * filterMedia.unitCost,
          source: 'manual',
          createdBy: owner._id,
          sentAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        })
        .returning();
      const [filterPOLine] = await db
        .insert(purchaseOrderLines)
        .values({ purchaseOrder: filterPO._id, supply: filterMedia._id, quantityOrdered: 5, unitCost: filterMedia.unitCost })
        .returning();
      await receivePurchaseOrder({
        purchaseOrderId: filterPO._id,
        receivedLines: [{ lineId: filterPOLine._id, quantityReceived: 5 }],
        location: mainLocation._id,
      });
      await closePurchaseOrder(filterPO._id);
    }

    // --- Support tickets ---------------------------------------------------
    const ticketSeed = [
      {
        customer: createdCustomers[0]._id,
        location: mainLocation._id,
        subject: 'Scratch on rear bumper after wash',
        category: 'damage-claim',
        priority: 'high',
        status: 'open',
        description: 'Customer noticed a scratch at pickup, wants it looked at.',
        source: 'in-app',
        createdBy: owner._id,
      },
      {
        customer: createdCustomers[1]._id,
        location: mainLocation._id,
        subject: 'Charged twice for membership this month',
        category: 'billing-dispute',
        priority: 'normal',
        status: 'in-progress',
        description: 'Two charges on the same card on the same day.',
        source: 'whatsapp',
        assignedTo: staff[0]?._id,
        firstRespondedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        createdBy: owner._id,
      },
      {
        customer: createdCustomers[2]._id,
        location: mainLocation._id,
        subject: 'Interior still had crumbs after Signature wash',
        category: 'quality-complaint',
        priority: 'normal',
        status: 'resolved',
        description: 'Requested a free rework, completed same day.',
        source: 'whatsapp',
        assignedTo: staff[1]?._id,
        firstRespondedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
        resolvedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
        createdBy: owner._id,
      },
    ];
    const createdTickets = await db.insert(tickets).values(ticketSeed).returning();
    await db.insert(ticketComments).values([
      {
        ticket: createdTickets[1]._id,
        author: staff[0]?._id,
        authorType: 'staff',
        body: 'Looked into it — one charge was a pending auth that already dropped off. Confirming with customer.',
      },
      {
        ticket: createdTickets[2]._id,
        author: staff[1]?._id,
        authorType: 'system',
        body: 'Status changed: in-progress → resolved',
      },
    ]);

    return { createdLocations, createdBays, createdPackages };
  });
};

const run = async () => {
  await connectDB();
  console.log('Seeding database...');

  // Clear every table (children first so foreign keys hold) — SQLite/libSQL has
  // no TRUNCATE, so this is an explicit DELETE per table.
  const tables = [
    'audit_logs', 'invites',
    'stock_adjustments', 'purchase_order_lines', 'purchase_orders', 'package_supply_usage',
    'location_stock', 'supplies', 'suppliers',
    'leave_requests', 'shifts', 'employees',
    'ticket_comments', 'tickets',
    'membership_subscriptions', 'membership_plans', 'customer_messages', 'wash_orders',
    'package_pricing', 'wash_packages', 'service_bays', 'booking_services', 'bookings',
    'expenses', 'notifications', 'vehicles', 'services', 'customers',
    'location_stock', 'tenant_subscriptions', 'tenant_members', 'tenant_domains',
    'locations', 'tenants', 'users', 'saas_plans',
  ];
  for (const table of [...new Set(tables)]) {
    await client.execute(`DELETE FROM "${table}"`);
  }

  // The SaaS plan catalogue.
  await syncPlans();

  // The SaaS operator's own account — the only role that can see every business.
  await db.insert(users).values({
    name: 'Platform Admin',
    email: 'platform@carwash.com',
    password: hash('platform123'),
    phone: '555-0000',
    platformRole: 'platform_admin',
    avatarColor: '#0f172a',
  });

  // --- Business 1: Sparkle Wash (two branches, Growth plan) ---------------
  const sparkleStaff = [
    { name: 'Alex Owner', email: 'owner@carwash.com', password: 'admin123', role: 'owner', phone: '555-0100', avatarColor: '#2563eb' },
    { name: 'Maria Manager', email: 'manager@carwash.com', password: 'manager123', role: 'manager', phone: '555-0101', avatarColor: '#7c3aed' },
    { name: 'John Staff', email: 'john@carwash.com', password: 'staff123', role: 'staff', phone: '555-0102', avatarColor: '#0891b2' },
    { name: 'Sara Staff', email: 'sara@carwash.com', password: 'staff123', role: 'staff', phone: '555-0103', avatarColor: '#ea580c' },
    { name: 'Mike Staff', email: 'mike@carwash.com', password: 'staff123', role: 'staff', phone: '555-0104', avatarColor: '#16a34a' },
  ];

  // --- Business 2: AutoShine Detailing (one branch, Starter plan) ---------
  const autoshineStaff = [
    { name: 'Dana Owner', email: 'owner@autoshine.com', password: 'admin123', role: 'owner', phone: '555-0200', avatarColor: '#db2777' },
    { name: 'Omar Staff', email: 'staff@autoshine.com', password: 'staff123', role: 'staff', phone: '555-0201', avatarColor: '#16a34a' },
  ];

  const businesses = [
    {
      key: 'sparkle',
      name: 'Sparkle Wash',
      slug: 'sparkle-wash',
      planCode: 'growth',
      status: 'active',
      brandColor: '#0284c7',
      currency: 'USD',
      timezone: 'Asia/Riyadh',
      phone: '555-0100',
      address: '12 Ocean View Ave',
      locationNames: [
        { name: 'Downtown Branch', code: 'DOWNTOWN', address: '12 Ocean View Ave', city: 'Springfield', country: 'USA', phone: '555-0100' },
        { name: 'Airport Branch', code: 'AIRPORT', address: '4 Terminal Road', city: 'Springfield', country: 'USA', phone: '555-0110' },
      ],
      staff: sparkleStaff,
    },
    {
      key: 'autoshine',
      name: 'AutoShine Detailing',
      slug: 'autoshine',
      planCode: 'starter',
      status: 'trial',
      brandColor: '#7c3aed',
      currency: 'USD',
      timezone: 'Asia/Riyadh',
      phone: '555-0200',
      address: '88 Polisher Lane',
      locationNames: [
        { name: 'Detailing Studio', code: 'STUDIO', address: '88 Polisher Lane', city: 'Springfield', country: 'USA', phone: '555-0200' },
      ],
      staff: autoshineStaff,
    },
  ];

  for (const business of businesses) {
    // The owner account + business, created exactly like a self-serve signup.
    const [ownerUser] = await db
      .insert(users)
      .values({
        name: business.staff[0].name,
        email: business.staff[0].email.toLowerCase(),
        password: hash(business.staff[0].password),
        phone: business.staff[0].phone,
        platformRole: 'user',
      })
      .returning();

    const { tenant } = await runAsPlatform(() =>
      createTenant({
        name: business.name,
        slug: business.slug,
        planCode: business.planCode,
        status: business.status,
        brandColor: business.brandColor,
        currency: business.currency,
        timezone: business.timezone,
        phone: business.phone,
        address: business.address,
        owner: ownerUser,
        locationName: business.locationNames[0].name,
        skipOnboarding: true,
      })
    );

    // The owner account was created by createTenant — remove it from the staff
    // list so it isn't inserted twice.
    const restStaff = business.staff.slice(1);
    const features = { memberships: true, inventory: true, hr: true, whatsapp: true };

    await seedTenant({
      tenant: { ...tenant, timezone: business.timezone },
      features,
      ownerUser,
      staffRows: restStaff,
      locationNames: business.locationNames,
    });

    console.log(`  seeded business: ${business.name} (/${business.slug})`);
  }

  console.log('Seed complete!');
  console.log('---------------------------------');
  console.log('Platform admin: platform@carwash.com / platform123');
  console.log('Sparkle Wash:   owner@carwash.com / admin123');
  console.log('                manager@carwash.com / manager123');
  console.log('                john@carwash.com / staff123');
  console.log('AutoShine:      owner@autoshine.com / admin123');
  console.log('---------------------------------');

  await client.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
