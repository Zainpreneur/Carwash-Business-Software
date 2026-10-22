import { z } from 'zod';
import {
  BAY_STATUSES,
  BAY_TYPES,
  DELIVERY_LANES,
  MEMBERSHIP_STATUSES,
  PACKAGE_TIERS,
  PAYMENT_METHODS,
  QC_RESULTS,
  WASH_ORDER_STATUSES,
} from '../constants.js';
import { idSchema, isoDateSchema, moneySchema } from './common.js';

// ----------------------------- Wash packages ------------------------------

export const packagePricingSchema = z.object({
  vehicleType: z.enum(['sedan-coupe', 'suv-truck', 'van-oversized']),
  price: moneySchema,
});

export const createWashPackageSchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  name: z.string().trim().min(2).max(120),
  deliveryLane: z.enum(DELIVERY_LANES).default('tunnel'),
  includesInterior: z.boolean().default(false),
  avgCycleTimeMinutes: z.number().int().min(1).max(600).default(15),
  pricing: z.array(packagePricingSchema).min(1),
  active: z.boolean().default(true),
});
export type CreateWashPackageInput = z.infer<typeof createWashPackageSchema>;

export const updateWashPackageSchema = createWashPackageSchema.partial();
export type UpdateWashPackageInput = z.infer<typeof updateWashPackageSchema>;

// ------------------------------ Service bays ------------------------------

export const createServiceBaySchema = z.object({
  locationId: idSchema,
  bayNumber: z.number().int().min(1).max(999),
  bayType: z.enum(BAY_TYPES).default('tunnel-conveyor'),
  operationalStatus: z.enum(BAY_STATUSES).default('operational'),
  avgThroughputPerHour: z.number().nonnegative().nullable().optional(),
});
export type CreateServiceBayInput = z.infer<typeof createServiceBaySchema>;

export const updateServiceBaySchema = createServiceBaySchema.partial();
export type UpdateServiceBayInput = z.infer<typeof updateServiceBaySchema>;

// ------------------------------- Wash orders ------------------------------

export const createWashOrderSchema = z.object({
  locationId: idSchema.nullable().optional(),
  customerId: idSchema.nullable().optional(),
  vehicleId: idSchema,
  packageId: idSchema,
  assignedTechnicianId: idSchema.nullable().optional(),
  bookingType: z.enum(['walk-in', 'appointment']).default('walk-in'),
  scheduledFor: isoDateSchema.nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  promoCode: z.string().trim().max(40).optional(),
});
export type CreateWashOrderInput = z.infer<typeof createWashOrderSchema>;

export const washOrderTransitionSchema = z.object({
  status: z.enum(WASH_ORDER_STATUSES),
  bayId: idSchema.nullable().optional(),
  qcResult: z.enum(QC_RESULTS).nullable().optional(),
  note: z.string().max(500).optional(),
});
export type WashOrderTransitionInput = z.infer<typeof washOrderTransitionSchema>;

// -------------------------------- Membership ------------------------------

export const createMembershipPlanSchema = z.object({
  tier: z.enum(['basic-unlimited', 'premium-unlimited', 'fleet-unlimited']),
  name: z.string().trim().min(2).max(120),
  coveredPackageId: idSchema,
  monthlyPrice: moneySchema,
  isUnlimited: z.boolean().default(true),
  washesPerMonthCap: z.number().int().min(1).max(1000).nullable().optional(),
  rolloverAllowed: z.boolean().default(false),
});
export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;

export const createMembershipSubscriptionSchema = z.object({
  customerId: idSchema,
  vehicleId: idSchema,
  planId: idSchema,
  billingDayOfMonth: z.number().int().min(1).max(28),
});
export type CreateMembershipSubscriptionInput = z.infer<typeof createMembershipSubscriptionSchema>;

export const updateMembershipSubscriptionSchema = z.object({
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
  pausedUntil: isoDateSchema.nullable().optional(),
});
export type UpdateMembershipSubscriptionInput = z.infer<typeof updateMembershipSubscriptionSchema>;
