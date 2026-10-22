import { z } from 'zod';

/** UUID-shaped id (ids are generated client-side as crypto.randomUUID()). */
export const idSchema = z.string().uuid();

/** Pagination query params shared by all list endpoints. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type Pagination = z.infer<typeof paginationSchema>;

/** Standard list response envelope. */
export const paginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });

/** ISO date string accepted from clients, coerced to a Date. */
export const isoDateSchema = z.coerce.date();

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{6,20}$/, 'Invalid phone number');

export const emailSchema = z.string().trim().email().max(254);

/** Non-negative money amount. */
export const moneySchema = z.number().finite().nonnegative();

/** API error envelope. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
