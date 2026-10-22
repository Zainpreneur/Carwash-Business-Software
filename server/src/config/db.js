require('dotenv').config();
const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const schema = require('../db/schema');
const { createTenantDb } = require('../db/tenantDb');

// The URL decides the backend:
//   file:local.db          -> local SQLite file (dev / single-VPS)
//   libsql://xxx.turso.io -> Turso (libSQL cloud) — same driver, same SQL dialect.
// The auth token is only needed for the remote flavour.
const url = process.env.LIBSQL_URL || 'file:local.db';

const client = createClient({
  url,
  ...(url.startsWith('file:') ? { offline: true } : {}),
  ...(process.env.LIBSQL_AUTH_TOKEN ? { authToken: process.env.LIBSQL_AUTH_TOKEN } : {}),
});

// Raw (unscoped) Drizzle client. Used by the platform layer (signup, tenant
// provisioning, the SaaS console) and by anything that deliberately needs to
// read across tenants.
const rawDb = drizzle(client, { schema });

// Tenant-scoped client. This is what the rest of the app imports as `db`:
// every query is automatically limited to the active tenant, and every insert
// is automatically stamped with it.
const db = createTenantDb(rawDb);

const connectDB = async () => {
  await client.execute('SELECT 1');
};

module.exports = { client, rawDb, db, connectDB };
