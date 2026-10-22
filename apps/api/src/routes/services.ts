import { services } from '@carwash/db/schema';
import { createServiceSchema, updateServiceSchema } from '@carwash/shared/schemas';
import { Hono } from 'hono';
import { createCrudRoutes } from '../lib/crud.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  .route(
    '/',
    createCrudRoutes({
      table: services,
      idColumn: services._id,
      searchColumns: [services.name, services.category],
      sortable: { createdAt: services.createdAt, name: services.name, price: services.price },
      createSchema: createServiceSchema,
      updateSchema: updateServiceSchema,
      omitOnWrite: ['tenant'],
    })
  );
export default router;
