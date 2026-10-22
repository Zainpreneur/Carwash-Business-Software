const { db } = require('../config/db');
const {
  locations,
  serviceBays,
  washPackages,
  packagePricing,
  services,
  membershipPlans,
} = require('../db/schema');

/**
 * Give a brand-new business a working starting point.
 *
 * A car wash cannot open its doors with an empty database: the wash floor needs
 * bays, the price list needs packages, the booking screen needs services. This
 * creates that minimum viable business so a self-serve signup lands on a usable
 * app instead of a blank slate.
 *
 * Must be called inside a tenant context (the data layer stamps the tenant).
 */

const DEFAULT_SERVICES = [
  { name: 'Express Wash', category: 'basic', price: 15, durationMinutes: 20, description: 'Quick exterior rinse & dry' },
  { name: 'Standard Wash & Vacuum', category: 'basic', price: 25, durationMinutes: 35, description: 'Exterior wash with interior vacuum' },
  { name: 'Deluxe Wash', category: 'premium', price: 40, durationMinutes: 50, description: 'Wash, wax, tire shine & vacuum' },
  { name: 'Full Detailing', category: 'detailing', price: 120, durationMinutes: 150, description: 'Complete interior & exterior detailing' },
  { name: 'Interior Deep Clean', category: 'detailing', price: 70, durationMinutes: 90, description: 'Deep upholstery & carpet cleaning' },
  { name: 'Wax & Polish', category: 'addon', price: 30, durationMinutes: 40, description: 'Hand wax and paint polish' },
  { name: 'Engine Bay Cleaning', category: 'addon', price: 20, durationMinutes: 25, description: 'Degrease and clean engine bay' },
  { name: 'Ceramic Coating', category: 'premium', price: 200, durationMinutes: 180, description: 'Long-lasting ceramic paint protection' },
];

const DEFAULT_PACKAGES = [
  {
    tier: 'express-exterior',
    name: 'Express Exterior',
    deliveryLane: 'tunnel',
    includesInterior: false,
    avgCycleTimeMinutes: 8,
    pricing: { 'sedan-coupe': 12, 'suv-truck': 15, 'van-oversized': 18 },
  },
  {
    tier: 'exterior-plus',
    name: 'Exterior Plus',
    deliveryLane: 'tunnel',
    includesInterior: false,
    avgCycleTimeMinutes: 12,
    pricing: { 'sedan-coupe': 20, 'suv-truck': 24, 'van-oversized': 28 },
  },
  {
    tier: 'signature-full-service',
    name: 'Signature Full-Service',
    deliveryLane: 'detail-bay',
    includesInterior: true,
    avgCycleTimeMinutes: 45,
    pricing: { 'sedan-coupe': 45, 'suv-truck': 55, 'van-oversized': 65 },
  },
  {
    tier: 'premium-hand-detail',
    name: 'Premium Hand Detail',
    deliveryLane: 'detail-bay',
    includesInterior: true,
    avgCycleTimeMinutes: 90,
    pricing: { 'sedan-coupe': 90, 'suv-truck': 110, 'van-oversized': 130 },
  },
];

const DEFAULT_BAYS = [
  ...[1, 2, 3].map((n) => ({ bayNumber: n, bayType: 'tunnel-conveyor', avgThroughputPerHour: 12 })),
  ...[4, 5].map((n) => ({ bayNumber: n, bayType: 'detail-bay', avgThroughputPerHour: 1.3 })),
];

/**
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.locationName
 * @param {object} opts.features  effective feature flags of the tenant's plan
 */
const onboardTenant = async ({ tenantId, locationName, features = {} }) => {
  const [location] = await db
    .insert(locations)
    .values({
      name: locationName || 'Main Branch',
      code: 'MAIN',
      address: null,
      city: null,
      country: null,
      phone: null,
      timezone: null,
      active: true,
    })
    .returning();

  await db.insert(serviceBays).values(DEFAULT_BAYS.map((b) => ({ ...b, location: location._id })));

  await db.insert(services).values(DEFAULT_SERVICES.map((s) => ({ ...s })));

  const createdPackages = await db
    .insert(washPackages)
    .values(DEFAULT_PACKAGES.map(({ pricing, ...p }) => p))
    .returning();

  await db.insert(packagePricing).values(
    createdPackages.flatMap((pkg, i) =>
      Object.entries(DEFAULT_PACKAGES[i].pricing).map(([vehicleType, price]) => ({
        package: pkg._id,
        vehicleType,
        price,
      }))
    )
  );

  if (features.memberships) {
    await db.insert(membershipPlans).values([
      {
        tier: 'basic-unlimited',
        name: 'Basic Unlimited',
        coveredPackage: createdPackages[0]._id,
        monthlyPrice: 29,
        isUnlimited: true,
        rolloverAllowed: false,
      },
      {
        tier: 'premium-unlimited',
        name: 'Premium Unlimited',
        coveredPackage: createdPackages[1]._id,
        monthlyPrice: 49,
        isUnlimited: true,
        rolloverAllowed: true,
      },
    ]);
  }

  return { location, packages: createdPackages };
};

module.exports = { onboardTenant, DEFAULT_SERVICES, DEFAULT_PACKAGES, DEFAULT_BAYS };
