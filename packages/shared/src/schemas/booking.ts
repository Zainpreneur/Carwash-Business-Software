import { z } from 'zod';
import {
  BOOKING_PRIORITIES,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../constants.js';
import { idSchema, isoDateSchema, moneySchema } from './common.js';

export const bookingLineSchema = z.object({
  serviceId: idSchema.nullable().optional(),
  name: z.string().trim().min(1).max(120),
  price: moneySchema,
});

export const createBookingSchema = z.object({
  locationId: idSchema.nullable().optional(),
  customerId: idSchema,
  vehicleId: idSchema,
  assignedStaffId: idSchema.nullable().optional(),
  scheduledAt: isoDateSchema,
  priority: z.enum(BOOKING_PRIORITIES).default('normal'),
  services: z.array(bookingLineSchema).min(1),
  discount: moneySchema.default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  notes: z.string().max(2000).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingSchema = z.object({
  scheduledAt: isoDateSchema.optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  priority: z.enum(BOOKING_PRIORITIES).optional(),
  assignedStaffId: idSchema.nullable().optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().max(2000).optional(),
});
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const publicBookingSchema = z.object({
  tenantSlug: z.string().trim().min(2).max(60),
  locationId: idSchema.nullable().optional(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(20),
    email: z.string().email().max(254).optional(),
  }),
  vehicle: z.object({
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    plateNumber: z.string().trim().min(1).max(20),
    type: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle', 'other']),
  }),
  serviceIds: z.array(idSchema).min(1),
  scheduledAt: isoDateSchema,
  notes: z.string().max(1000).optional(),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
