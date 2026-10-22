import { z } from 'zod';
import {
  EMPLOYEE_POSITIONS,
  EMPLOYEE_STATUSES,
  LEAVE_STATUSES,
  PURCHASE_ORDER_STATUSES,
  SHIFT_STATUSES,
  STOCK_ADJUSTMENT_REASONS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  WAREHOUSES,
} from '../constants.js';
import { idSchema, isoDateSchema, moneySchema } from './common.js';

// -------------------------------- Tickets ---------------------------------

export const createTicketSchema = z.object({
  locationId: idSchema.nullable().optional(),
  customerId: idSchema,
  washOrderId: idSchema.nullable().optional(),
  subject: z.string().trim().min(3).max(200),
  category: z.enum(TICKET_CATEGORIES).default('general'),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  description: z.string().max(5000).optional(),
  source: z.enum(['whatsapp', 'phone', 'google-business-profile', 'in-app']).default('in-app'),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedToId: idSchema.nullable().optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const addTicketCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;

// ---------------------------------- HR ------------------------------------

export const createEmployeeSchema = z.object({
  locationId: idSchema.nullable().optional(),
  userId: idSchema.nullable().optional(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().max(254).optional(),
  position: z.enum(EMPLOYEE_POSITIONS),
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
  hireDate: isoDateSchema.nullable().optional(),
  hourlyRate: moneySchema.nullable().optional(),
  annualSalary: moneySchema.nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial();
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const createShiftSchema = z.object({
  locationId: idSchema.nullable().optional(),
  employeeId: idSchema,
  bayId: idSchema.nullable().optional(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
  status: z.enum(SHIFT_STATUSES).default('scheduled'),
});
export type CreateShiftInput = z.infer<typeof createShiftSchema>;

export const createLeaveRequestSchema = z.object({
  employeeId: idSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  reason: z.string().max(1000).optional(),
});
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
});
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;

// ------------------------------- Inventory --------------------------------

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  leadTimeDays: z.number().int().min(0).max(365),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createSupplySchema = z.object({
  name: z.string().trim().min(2).max(120),
  warehouse: z.enum(WAREHOUSES).default('main-chemical-room'),
  unit: z.string().trim().max(20).default('unit'),
  quantityOnHand: z.number().nonnegative().default(0),
  unitCost: moneySchema.default(0),
  supplierId: idSchema.nullable().optional(),
});
export type CreateSupplyInput = z.infer<typeof createSupplySchema>;

export const updateSupplySchema = createSupplySchema.partial();
export type UpdateSupplyInput = z.infer<typeof updateSupplySchema>;

export const createPurchaseOrderSchema = z.object({
  locationId: idSchema.nullable().optional(),
  supplierId: idSchema,
  lines: z
    .array(
      z.object({
        supplyId: idSchema,
        quantityOrdered: z.number().positive(),
        unitCost: moneySchema,
      })
    )
    .min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const receivePurchaseOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: idSchema,
        quantityReceived: z.number().nonnegative(),
      })
    )
    .min(1),
});
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;

export const createStockAdjustmentSchema = z.object({
  locationId: idSchema.nullable().optional(),
  supplyId: idSchema,
  quantityDelta: z.number().refine((v) => v !== 0, 'Must be non-zero'),
  reasonCode: z.enum(STOCK_ADJUSTMENT_REASONS),
  notes: z.string().max(1000).optional(),
  approvedBy: idSchema,
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;

export { PURCHASE_ORDER_STATUSES };
