// ---------------------------------------------------------------------------
// Domain enums shared by the API and the web client
// ---------------------------------------------------------------------------

export const TENANT_STATUSES = ['trial', 'active', 'suspended', 'closed'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_ROLES = ['owner', 'admin', 'manager', 'staff'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const PLATFORM_ROLES = ['user', 'platform_admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in-progress',
  'completed',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type BookingPriority = (typeof BOOKING_PRIORITIES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'partial'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'membership', 'fleet-invoice', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const VEHICLE_TYPES = ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'other'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const PACKAGE_TIERS = [
  'express-exterior',
  'exterior-plus',
  'signature-full-service',
  'premium-hand-detail',
] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

export const DELIVERY_LANES = ['tunnel', 'detail-bay'] as const;
export type DeliveryLane = (typeof DELIVERY_LANES)[number];

export const BAY_TYPES = ['tunnel-conveyor', 'detail-bay'] as const;
export type BayType = (typeof BAY_TYPES)[number];

export const BAY_STATUSES = ['operational', 'degraded', 'down', 'retired'] as const;
export type BayStatus = (typeof BAY_STATUSES)[number];

export const WASH_ORDER_STATUSES = [
  'queued',
  'bay-assigned',
  'in-wash',
  'quality-check',
  'ready-for-pickup',
  'completed',
  'cancelled',
] as const;
export type WashOrderStatus = (typeof WASH_ORDER_STATUSES)[number];

export const QC_RESULTS = ['pass', 'fail'] as const;
export type QcResult = (typeof QC_RESULTS)[number];

/** Allowed wash-order state transitions (terminal: completed, cancelled). */
export const WASH_ORDER_TRANSITIONS: Record<WashOrderStatus, WashOrderStatus[]> = {
  queued: ['bay-assigned', 'cancelled'],
  'bay-assigned': ['in-wash', 'cancelled'],
  'in-wash': ['quality-check'],
  'quality-check': ['ready-for-pickup', 'in-wash'],
  'ready-for-pickup': ['completed'],
  completed: [],
  cancelled: [],
};

export const MEMBERSHIP_STATUSES = [
  'active',
  'paused',
  'past-due',
  'suspended',
  'cancelled',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const TICKET_CATEGORIES = [
  'damage-claim',
  'billing-dispute',
  'quality-complaint',
  'membership-question',
  'general',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = [
  'open',
  'in-progress',
  'waiting-on-customer',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const EMPLOYEE_POSITIONS = [
  'bay-attendant',
  'wash-technician',
  'detail-technician',
  'cashier',
  'site-manager',
  'fleet-account-manager',
] as const;
export type EmployeePosition = (typeof EMPLOYEE_POSITIONS)[number];

export const EMPLOYEE_STATUSES = [
  'applicant',
  'hired',
  'onboarding',
  'active',
  'on-leave',
  'offboarded',
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const SHIFT_STATUSES = ['scheduled', 'completed', 'no-show', 'cancelled'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'denied'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'sent',
  'partially-received',
  'received',
  'closed',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const STOCK_ADJUSTMENT_REASONS = [
  'breakage',
  'spillage',
  'theft',
  'expired',
  'count-correction',
] as const;
export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export const WAREHOUSES = ['main-chemical-room', 'detail-bay-storage'] as const;
export type Warehouse = (typeof WAREHOUSES)[number];
