import {
  locations,
  packagePricing,
  saasPlans,
  serviceBays,
  services,
  supplies,
  tenantMembers,
  tenantSubscriptions,
  tenants,
  users,
  washPackages,
} from '@carwash/db/schema';
/**
 * Seed script — idempotent demo data.
 *
 *   pnpm --filter @carwash/api seed [owner-email]
 *
 * Provisions a `demo` tenant with a location, wash packages + pricing, services,
 * bays and supplies. If an existing user matches the owner email (or
 * SEED_ADMIN_EMAIL), they are made the tenant owner.
 *
 * NOTE: logins are created through Better Auth (the UI's sign-up form), not here,
 * so password hashing stays in one place. Sign up first, then run this script.
 */
import { eq } from 'drizzle-orm';
import { connectDB, platformDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    maxLocations: 1,
    maxStaff: 5,
    maxCustomers: 500,
    sortOrder: 1,
    features: {},
  },
  {
    code: 'growth',
    name: 'Growth',
    priceMonthly: 79,
    maxLocations: 3,
    maxStaff: 25,
    maxCustomers: 5000,
    sortOrder: 2,
    features: { memberships: true, reports: true, whatsapp: true },
  },
  {
    code: 'scale',
    name: 'Scale',
    priceMonthly: 199,
    maxLocations: 10,
    maxStaff: 200,
    maxCustomers: 50000,
    sortOrder: 3,
    features: { memberships: true, inventory: true, hr: true, reports: true, whatsapp: true },
  },
];

async function seed(): Promise<void> {
  await connectDB();

  // 1. SaaS plan catalogue
  for (const plan of PLANS) {
    const [existing] = await platformDb
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.code, plan.code))
      .limit(1);
    if (!existing) {
      await platformDb.insert(saasPlans).values(plan);
      logger.info({ plan: plan.code }, 'seeded plan');
    }
  }

  // 2. Demo tenant
  let [tenant] = await platformDb.select().from(tenants).where(eq(tenants.slug, 'demo')).limit(1);
  if (!tenant) {
    [tenant] = await platformDb
      .insert(tenants)
      .values({
        name: 'Demo Car Wash',
        slug: 'demo',
        status: 'active',
        plan: 'growth',
        currency: 'USD',
        timezone: 'America/New_York',
        taxRate: 0.08,
        phone: '+1 555 0100',
        address: '100 Suds Ave',
      })
      .returning();
    logger.info('seeded demo tenant');
  }
  if (!tenant) throw new Error('Failed to create demo tenant');

  // 3. Location
  let [location] = await platformDb
    .select()
    .from(locations)
    .where(eq(locations.tenant, tenant._id))
    .limit(1);
  if (!location) {
    [location] = await platformDb
      .insert(locations)
      .values({
        tenant: tenant._id,
        name: 'Main Street',
        code: 'MAIN',
        address: '100 Suds Ave',
        city: 'Springfield',
        country: 'US',
        timezone: 'America/New_York',
      })
      .returning();
    logger.info('seeded location');
  }
  if (!location) throw new Error('Failed to create location');

  // 4. Wash packages + pricing
  let packages = await platformDb
    .select()
    .from(washPackages)
    .where(eq(washPackages.tenant, tenant._id));
  if (packages.length === 0) {
    const defs = [
      {
        tier: 'express-exterior',
        name: 'Express Exterior',
        deliveryLane: 'tunnel',
        includesInterior: false,
        avgCycleTimeMinutes: 10,
        prices: [12, 16, 20],
      },
      {
        tier: 'exterior-plus',
        name: 'Exterior Plus',
        deliveryLane: 'tunnel',
        includesInterior: false,
        avgCycleTimeMinutes: 15,
        prices: [18, 23, 28],
      },
      {
        tier: 'signature-full-service',
        name: 'Signature Full Service',
        deliveryLane: 'tunnel',
        includesInterior: true,
        avgCycleTimeMinutes: 25,
        prices: [29, 35, 42],
      },
      {
        tier: 'premium-hand-detail',
        name: 'Premium Hand Detail',
        deliveryLane: 'detail-bay',
        includesInterior: true,
        avgCycleTimeMinutes: 90,
        prices: [89, 109, 129],
      },
    ] as const;
    const tiers = ['sedan-coupe', 'suv-truck', 'van-oversized'] as const;

    packages = [];
    for (const def of defs) {
      const [pkg] = await platformDb
        .insert(washPackages)
        .values({
          tenant: tenant._id,
          tier: def.tier,
          name: def.name,
          deliveryLane: def.deliveryLane,
          includesInterior: def.includesInterior,
          avgCycleTimeMinutes: def.avgCycleTimeMinutes,
        })
        .returning();
      if (!pkg) continue;
      packages.push(pkg);
      await platformDb.insert(packagePricing).values(
        tiers.map((vehicleType, i) => ({
          tenant: tenant._id,
          package: pkg._id,
          vehicleType,
          price: def.prices[i] ?? def.prices[0],
        }))
      );
    }
    logger.info({ count: packages.length }, 'seeded wash packages');
  }

  // 5. Services
  const existingServices = await platformDb
    .select()
    .from(services)
    .where(eq(services.tenant, tenant._id));
  if (existingServices.length === 0) {
    await platformDb.insert(services).values([
      {
        tenant: tenant._id,
        name: 'Express Wash',
        category: 'basic',
        price: 12,
        durationMinutes: 10,
      },
      {
        tenant: tenant._id,
        name: 'Full Service Wash',
        category: 'full',
        price: 29,
        durationMinutes: 25,
      },
      {
        tenant: tenant._id,
        name: 'Interior Detail',
        category: 'detail',
        price: 49,
        durationMinutes: 60,
      },
      { tenant: tenant._id, name: 'Hand Wax', category: 'addon', price: 19, durationMinutes: 20 },
    ]);
    logger.info('seeded services');
  }

  // 6. Bays
  const existingBays = await platformDb
    .select()
    .from(serviceBays)
    .where(eq(serviceBays.tenant, tenant._id));
  if (existingBays.length === 0) {
    await platformDb.insert(serviceBays).values([
      {
        tenant: tenant._id,
        location: location._id,
        bayNumber: 1,
        bayType: 'tunnel-conveyor',
        avgThroughputPerHour: 40,
      },
      {
        tenant: tenant._id,
        location: location._id,
        bayNumber: 2,
        bayType: 'tunnel-conveyor',
        avgThroughputPerHour: 40,
      },
      {
        tenant: tenant._id,
        location: location._id,
        bayNumber: 3,
        bayType: 'detail-bay',
        avgThroughputPerHour: 4,
      },
    ]);
    logger.info('seeded service bays');
  }

  // 7. Supplies
  const existingSupplies = await platformDb
    .select()
    .from(supplies)
    .where(eq(supplies.tenant, tenant._id));
  if (existingSupplies.length === 0) {
    await platformDb.insert(supplies).values([
      {
        tenant: tenant._id,
        name: 'Foam Shampoo',
        warehouse: 'main-chemical-room',
        unit: 'gallon',
        quantityOnHand: 40,
        unitCost: 12,
      },
      {
        tenant: tenant._id,
        name: 'Tire Shine',
        warehouse: 'detail-bay-storage',
        unit: 'gallon',
        quantityOnHand: 8,
        unitCost: 18,
      },
      {
        tenant: tenant._id,
        name: 'Microfiber Towels',
        warehouse: 'detail-bay-storage',
        unit: 'pack',
        quantityOnHand: 6,
        unitCost: 25,
      },
    ]);
    logger.info('seeded supplies');
  }

  // 8. Subscription + owner
  const existingSub = await platformDb
    .select()
    .from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenant, tenant._id))
    .limit(1);
  if (!existingSub.length) {
    await platformDb.insert(tenantSubscriptions).values({
      tenant: tenant._id,
      plan: 'growth',
      status: 'active',
      seats: 5,
    });
  }

  const ownerEmail = (process.argv[2] ?? process.env.SEED_ADMIN_EMAIL)?.toLowerCase();
  if (ownerEmail) {
    const [user] = await platformDb
      .select()
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);
    if (user) {
      const existingMember = await platformDb
        .select()
        .from(tenantMembers)
        .where(eq(tenantMembers.tenant, tenant._id))
        .limit(1);
      if (!existingMember.length) {
        await platformDb.insert(tenantMembers).values({
          tenant: tenant._id,
          user: user.id,
          role: 'owner',
          status: 'active',
          scopeAllLocations: true,
        });
        logger.info({ email: ownerEmail }, 'attached demo owner');
      }
    } else {
      logger.warn({ email: ownerEmail }, 'no user with that email — sign up first, then rerun');
    }
  }

  logger.info('seed complete');
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
