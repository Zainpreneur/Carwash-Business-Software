import { index, real, sqliteTable, text, timestampMs, timestamps, uid } from '../columns.js';
import { locations, tenants, users } from './platform.js';
import { serviceBays } from './wash.js';

// ---------------------------------------------------------------------------
// HR — staff roster, shifts, leave. Employee is distinct from the login/RBAC
// role carried by `tenant_members`; `employees.user` links the two but is nullable.
// ---------------------------------------------------------------------------

export const employees = sqliteTable(
  'employees',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    user: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    /**
     * position: bay-attendant | wash-technician | detail-technician | cashier |
     * site-manager | fleet-account-manager
     */
    position: text('position').notNull(),
    /** status: applicant | hired | onboarding | active | on-leave | offboarded */
    status: text('status').notNull().default('active'),
    hireDate: timestampMs('hire_date'),
    hourlyRate: real('hourly_rate'),
    annualSalary: real('annual_salary'),
    commissionRate: real('commission_rate'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    ...timestamps,
  },
  (t) => [index('idx_employees_tenant').on(t.tenant)]
);

/** Shift: employeeId x time window x optional bayId. */
export const shifts = sqliteTable(
  'shifts',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    location: text('location_id').references(() => locations._id, { onDelete: 'set null' }),
    employee: text('employee_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'cascade' }),
    bay: text('bay_id').references(() => serviceBays._id, { onDelete: 'set null' }),
    startsAt: timestampMs('starts_at').notNull(),
    endsAt: timestampMs('ends_at').notNull(),
    /** status: scheduled | completed | no-show | cancelled */
    status: text('status').notNull().default('scheduled'),
    checkedInAt: timestampMs('checked_in_at'),
    checkedOutAt: timestampMs('checked_out_at'),
    ...timestamps,
  },
  (t) => [index('idx_shifts_tenant').on(t.tenant, t.startsAt)]
);

/** Leave management: request -> approval, blocks overlapping shift creation. */
export const leaveRequests = sqliteTable(
  'leave_requests',
  {
    _id: uid('_id'),
    tenant: text('tenant_id')
      .notNull()
      .references(() => tenants._id, { onDelete: 'cascade' }),
    employee: text('employee_id')
      .notNull()
      .references(() => employees._id, { onDelete: 'cascade' }),
    startDate: timestampMs('start_date').notNull(),
    endDate: timestampMs('end_date').notNull(),
    reason: text('reason'),
    /** status: pending | approved | denied */
    status: text('status').notNull().default('pending'),
    approvedBy: text('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('idx_leave_requests_tenant').on(t.tenant)]
);
