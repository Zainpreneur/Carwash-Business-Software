import { z } from 'zod';
import { PLATFORM_ROLES, TENANT_ROLES, TENANT_STATUSES } from '../constants.js';
import { emailSchema, idSchema, moneySchema, phoneSchema } from './common.js';

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  currency: z.string().length(3).default('USD'),
  timezone: z.string().max(64).default('Asia/Riyadh'),
  phone: phoneSchema.optional(),
  address: z.string().max(300).optional(),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/**
 * Self-serve signup: the business name is all we need; the slug is derived on
 * the server and the starter price list / bays are provisioned automatically.
 */
export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  currency: z.string().length(3).default('USD'),
  timezone: z.string().max(64).default('Asia/Riyadh'),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updateTenantSchema = createTenantSchema
  .omit({ slug: true })
  .partial()
  .extend({
    logoUrl: z.string().url().max(500).nullable().optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    taxRate: moneySchema.max(100).optional(),
    status: z.enum(TENANT_STATUSES).optional(),
    settings: z.record(z.unknown()).nullable().optional(),
  });
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(20),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  phone: phoneSchema.optional(),
  timezone: z.string().max(64).optional(),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(TENANT_ROLES).default('staff'),
  locationId: idSchema.nullable().optional(),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(TENANT_ROLES).optional(),
  status: z.enum(['active', 'invited', 'disabled']).optional(),
  locationId: idSchema.nullable().optional(),
  scopeAllLocations: z.boolean().optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.nullable().optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  platformRole: z.enum(PLATFORM_ROLES).optional(),
  active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const saasPlanSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(80),
  priceMonthly: moneySchema.default(0),
  maxLocations: z.number().int().min(1).default(1),
  maxStaff: z.number().int().min(1).default(5),
  maxCustomers: z.number().int().min(1).default(500),
  features: z.record(z.boolean()).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type SaasPlanInput = z.infer<typeof saasPlanSchema>;
