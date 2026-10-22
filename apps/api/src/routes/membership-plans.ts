import { membershipPlans } from '@carwash/db/schema';
import { createMembershipPlanSchema } from '@carwash/shared/schemas';
import { Hono } from 'hono';
import { createCrudRoutes } from '../lib/crud.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)
  .use('*', requireRole('manager'))

  .route(
    '/',
    createCrudRoutes({
      table: membershipPlans,
      idColumn: membershipPlans._id,
      searchColumns: [membershipPlans.name, membershipPlans.tier],
      sortable: {
        createdAt: membershipPlans.createdAt,
        monthlyPrice: membershipPlans.monthlyPrice,
      },
      createSchema: createMembershipPlanSchema,
      updateSchema: createMembershipPlanSchema.partial(),
      omitOnWrite: ['tenant'],
    })
  );
export default router;
