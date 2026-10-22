import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit runs with CWD `packages/db`, so it would otherwise miss the single
 * repo-root `.env` that the API uses. Load it here too; real process env wins.
 */
function loadRootEnv(): void {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../../.env');
  if (!existsSync(file)) return;
  const before = new Map(Object.entries(process.env));
  try {
    process.loadEnvFile(file);
    for (const [key, value] of before) {
      if (value !== undefined) process.env[key] = value;
    }
  } catch {
    // A malformed optional `.env` should not block migrations.
  }
}
loadRootEnv();

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  // `turso` covers both remote Turso databases and local libSQL files.
  dialect: 'turso',
  dbCredentials: {
    url: process.env.LIBSQL_URL || 'file:local.db',
    authToken: process.env.LIBSQL_AUTH_TOKEN || undefined,
  },
  verbose: true,
  strict: true,
});
