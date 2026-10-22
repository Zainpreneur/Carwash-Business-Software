import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Client, createClient } from '@libsql/client';
import { type LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema/index.js';

export type Database = LibSQLDatabase<typeof schema>;

export interface DbOptions {
  /** file:local.db (dev) or libsql://xxx.turso.io (cloud) */
  url: string;
  authToken?: string;
}

const packageDir = dirname(fileURLToPath(import.meta.url));

/**
 * Relative `file:` URLs are resolved against this package's directory, not the
 * process CWD. That keeps the API (`apps/api`) and drizzle-kit (`packages/db`)
 * pointed at the same local database during development.
 */
function resolveUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const rest = url.slice('file:'.length);
  if (
    rest === ':memory:' ||
    rest.startsWith('/') ||
    rest.startsWith('//') ||
    /^[A-Za-z]:/.test(rest)
  ) {
    return url;
  }
  return `file:${join(packageDir, '..', rest)}`;
}

/**
 * Create a raw (unscoped) Drizzle client. Used by the platform layer (signup,
 * tenant provisioning, the SaaS console) and anything reading across tenants.
 */
export function createDb(opts: DbOptions): { client: Client; db: Database } {
  const url = resolveUrl(opts.url);
  const client = createClient({
    url,
    ...(url.startsWith('file:') ? { offline: true } : {}),
    ...(opts.authToken ? { authToken: opts.authToken } : {}),
  });
  return { client, db: drizzle(client, { schema }) };
}

export * from './tenant-db.js';
