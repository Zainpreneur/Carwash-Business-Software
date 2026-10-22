import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Load the nearest `.env` walking up from this file. Running via
 * `pnpm --filter @carwash/api dev` puts the CWD in `apps/api`, while the
 * documented setup keeps a single `.env` at the repo root — this finds either.
 * Existing environment variables (Coolify, Docker, CI) always win.
 */
function loadLocalEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    const file = join(dir, '.env');
    if (existsSync(file)) {
      const before = new Map(Object.entries(process.env));
      try {
        process.loadEnvFile(file);
        // Real process environment (Coolify/Docker/CI/shell) must win over file values.
        for (const [key, value] of before) {
          if (value !== undefined) process.env[key] = value;
        }
      } catch {
        // A malformed optional `.env` should not stop production boot.
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

loadLocalEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database (libSQL / Turso)
  LIBSQL_URL: z.string().default('file:local.db'),
  LIBSQL_AUTH_TOKEN: z.string().optional(),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(16).default('dev-secret-change-me-please-32chars'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),

  // CORS / client
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Optional integrations
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
