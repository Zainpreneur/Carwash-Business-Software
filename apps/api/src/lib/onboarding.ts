import {
  locations,
  packagePricing,
  serviceBays,
  services,
  supplies,
  washPackages,
} from '@carwash/db/schema';
import { platformDb } from './db.js';

/**
 * Give a brand-new business a usable starting point: one branch, a few bays, a
 * starter price list and the services a booking screen needs. Without this a
 * self-serve signup lands on a set of empty screens.
 *
 * Must only be called after the tenant row exists.
 */

const STARTER_PACKAGES = [
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

const VEHICLE_TIERS = ['sedan-coupe', 'suv-truck', 'van-oversized'] as const;

const STARTER_SERVICES = [
  { name: 'Express Wash', category: 'basic', price: 12, durationMinutes: 10 },
  { name: 'Full Service Wash', category: 'full', price: 29, durationMinutes: 25 },
  { name: 'Interior Detail', category: 'detail', price: 49, durationMinutes: 60 },
  { name: 'Hand Wax', category: 'addon', price: 19, durationMinutes: 20 },
];

const STARTER_BAYS = [
  { bayNumber: 1, bayType: 'tunnel-conveyor', avgThroughputPerHour: 40 },
  { bayNumber: 2, bayType: 'tunnel-conveyor', avgThroughputPerHour: 40 },
  { bayNumber: 3, bayType: 'detail-bay', avgThroughputPerHour: 4 },
];

const STARTER_SUPPLIES = [
  {
    name: 'Foam Shampoo',
    warehouse: 'main-chemical-room',
    unit: 'gallon',
    quantityOnHand: 40,
    unitCost: 12,
  },
  {
    name: 'Tire Shine',
    warehouse: 'detail-bay-storage',
    unit: 'gallon',
    quantityOnHand: 8,
    unitCost: 18,
  },
  {
    name: 'Microfiber Towels',
    warehouse: 'detail-bay-storage',
    unit: 'pack',
    quantityOnHand: 6,
    unitCost: 25,
  },
];

export interface StarterData {
  locationId: string;
}

export async function provisionStarterData(
  tenantId: string,
  locationName = 'Main Branch'
): Promise<StarterData> {
  const [location] = await platformDb
    .insert(locations)
    .values({
      tenant: tenantId,
      name: locationName,
      code: 'MAIN',
      timezone: null,
    })
    .returning();
  if (!location) throw new Error('Failed to create the starter location');

  await platformDb.insert(serviceBays).values(
    STARTER_BAYS.map((bay) => ({
      ...bay,
      tenant: tenantId,
      location: location._id,
    }))
  );

  await platformDb.insert(services).values(
    STARTER_SERVICES.map((service) => ({
      ...service,
      tenant: tenantId,
    }))
  );

  await platformDb.insert(supplies).values(
    STARTER_SUPPLIES.map((supply) => ({
      ...supply,
      tenant: tenantId,
    }))
  );

  for (const def of STARTER_PACKAGES) {
    const [pkg] = await platformDb
      .insert(washPackages)
      .values({
        tenant: tenantId,
        tier: def.tier,
        name: def.name,
        deliveryLane: def.deliveryLane,
        includesInterior: def.includesInterior,
        avgCycleTimeMinutes: def.avgCycleTimeMinutes,
      })
      .returning();
    if (!pkg) continue;

    await platformDb.insert(packagePricing).values(
      VEHICLE_TIERS.map((vehicleType, i) => ({
        tenant: tenantId,
        package: pkg._id,
        vehicleType,
        price: def.prices[i] ?? def.prices[0],
      }))
    );
  }

  return { locationId: location._id };
}
