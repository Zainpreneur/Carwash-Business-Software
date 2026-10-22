import { vehicles } from '@carwash/db/schema';
import { createVehicleSchema, updateVehicleSchema } from '@carwash/shared/schemas';
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
      table: vehicles,
      idColumn: vehicles._id,
      searchColumns: [vehicles.plateNumber, vehicles.make, vehicles.model],
      sortable: { createdAt: vehicles.createdAt, plateNumber: vehicles.plateNumber },
      createSchema: createVehicleSchema,
      updateSchema: updateVehicleSchema,
      omitOnWrite: ['tenant'],
    })
  );
export default router;
