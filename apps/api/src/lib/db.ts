import { type Database, createDb } from '@carwash/db';
import { env } from '../env.js';
import { logger } from './logger.js';

/**
 * Raw, unscoped platform DB. Used for auth, tenant provisioning, the SaaS console,
 * and anything that deliberately reads across tenants.
 *
 * Tenant isolation strategy:
 *   - `tenant_id` is stamped/filtered in the data layer (see @carwash/db createTenantDb)
 *   - For hard isolation you can additionally provision one libSQL database per tenant;
 *     `tenantDbFor(tenantSlug)` below shows where that seam lives.
 */
const { client, db } = createDb({
  url: env.LIBSQL_URL,
  authToken: env.LIBSQL_AUTH_TOKEN,
});

export const platformDb: Database = db;
export const libsqlClient = client;

export async function connectDB(): Promise<void> {
  await client.execute('SELECT 1');
  logger.info(
    { url: env.LIBSQL_URL.startsWith('file:') ? 'local-file' : 'remote' },
    'database connected'
  );
}

/**
 * Per-tenant database seam.
 *
 * Today every tenant shares one database and rows are scoped by tenant_id.
 * To move to database-per-tenant, return a Drizzle client pointed at the
 * tenant's own libSQL database here instead of the shared one.
 */
export function tenantDbFor(_tenantSlug: string): Database {
  return platformDb;
}

export type AppDb = Database;
