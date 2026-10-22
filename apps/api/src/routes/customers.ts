import { customers } from '@carwash/db/schema';
import { createCustomerSchema, updateCustomerSchema } from '@carwash/shared/schemas';
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
      table: customers,
      idColumn: customers._id,
      searchColumns: [customers.name, customers.phone, customers.email, customers.referralCode],
      sortable: {
        createdAt: customers.createdAt,
        name: customers.name,
        totalSpent: customers.totalSpent,
      },
      createSchema: createCustomerSchema,
      updateSchema: updateCustomerSchema,
      omitOnWrite: ['tenant'],
    })
  );
export default router;
