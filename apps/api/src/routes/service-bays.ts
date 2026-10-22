import { serviceBays } from '@carwash/db/schema';
import { createServiceBaySchema, updateServiceBaySchema } from '@carwash/shared/schemas';
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
      table: serviceBays,
      idColumn: serviceBays._id,
      searchColumns: [serviceBays.bayType, serviceBays.operationalStatus],
      sortable: { createdAt: serviceBays.createdAt, bayNumber: serviceBays.bayNumber },
      createSchema: createServiceBaySchema,
      updateSchema: updateServiceBaySchema,
      omitOnWrite: ['tenant'],
    })
  );
export default router;
