import { employees, leaveRequests, shifts } from '@carwash/db/schema';
import {
  createEmployeeSchema,
  createLeaveRequestSchema,
  createShiftSchema,
  reviewLeaveRequestSchema,
  updateEmployeeSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createCrudRoutes } from '../lib/crud.js';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)
  .use('*', requireRole('manager'))

  // --------------------------------- Employees ------------------------------

  .route(
    '/employees',
    createCrudRoutes({
      table: employees,
      idColumn: employees._id,
      searchColumns: [employees.name, employees.phone, employees.email, employees.position],
      sortable: {
        createdAt: employees.createdAt,
        name: employees.name,
        position: employees.position,
      },
      createSchema: createEmployeeSchema,
      updateSchema: updateEmployeeSchema,
      omitOnWrite: ['tenant'],
    })
  )

  // ----------------------------------- Shifts -------------------------------

  .get('/shifts', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(shifts)
      .where(eq(shifts.tenant, tenant.id))
      .orderBy(shifts.startsAt);
    return c.json({ data: rows });
  })

  .post('/shifts', zValidator('json', createShiftSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const input = c.req.valid('json');

    // Block a shift that overlaps an approved leave request for the same employee.
    const leaves = await platformDb
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenant, tenant.id),
          eq(leaveRequests.employee, input.employeeId),
          eq(leaveRequests.status, 'approved')
        )
      );
    const overlaps = leaves.some(
      (l) => input.startsAt <= new Date(l.endDate) && input.endsAt >= new Date(l.startDate)
    );
    if (overlaps) {
      return c.json(
        {
          error: {
            code: 'leave_conflict',
            message: 'Employee is on approved leave during this shift',
          },
        },
        409
      );
    }

    const [row] = await platformDb
      .insert(shifts)
      .values({
        tenant: tenant.id,
        location: input.locationId ?? tenant.locationId,
        employee: input.employeeId,
        bay: input.bayId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.status,
      })
      .returning();
    return c.json({ data: row }, 201);
  })

  .patch('/shifts/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [row] = await platformDb
      .update(shifts)
      .set({ updatedAt: new Date() })
      .where(and(eq(shifts.tenant, tenant.id), eq(shifts._id, c.req.param('id'))))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: row });
  })

  // ----------------------------------- Leave --------------------------------

  .get('/leave', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.tenant, tenant.id))
      .orderBy(leaveRequests.startDate);
    return c.json({ data: rows });
  })

  .post('/leave', zValidator('json', createLeaveRequestSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const input = c.req.valid('json');
    const [row] = await platformDb
      .insert(leaveRequests)
      .values({
        tenant: tenant.id,
        employee: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      })
      .returning();
    return c.json({ data: row }, 201);
  })

  .patch('/leave/:id/review', zValidator('json', reviewLeaveRequestSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const user = c.get('user')!;
    const [row] = await platformDb
      .update(leaveRequests)
      .set({ status: c.req.valid('json').status, approvedBy: user.id, updatedAt: new Date() })
      .where(and(eq(leaveRequests.tenant, tenant.id), eq(leaveRequests._id, c.req.param('id'))))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ data: row });
  });
export default router;
