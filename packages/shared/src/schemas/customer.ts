import { z } from 'zod';
import { VEHICLE_TYPES } from '../constants.js';
import { emailSchema, idSchema, moneySchema, phoneSchema } from './common.js';

// ------------------------------- Customers --------------------------------

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema.optional(),
  phone: phoneSchema,
  address: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  whatsappOptIn: z.boolean().default(true),
  isFleetAccount: z.boolean().default(false),
  referredByCode: z.string().trim().max(40).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  active: z.boolean().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ------------------------------- Vehicles ---------------------------------

export const createVehicleSchema = z.object({
  customerId: idSchema,
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  color: z.string().trim().max(40).optional(),
  plateNumber: z.string().trim().min(1).max(20),
  type: z.enum(VEHICLE_TYPES).default('sedan'),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.omit({ customerId: true }).partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

// ------------------------------- Services ---------------------------------

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional(),
  category: z.string().trim().max(40).default('basic'),
  price: moneySchema,
  durationMinutes: z.number().int().min(1).max(1440).default(30),
  vehicleTypePricing: z.record(z.number().nonnegative()).nullable().optional(),
  active: z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
