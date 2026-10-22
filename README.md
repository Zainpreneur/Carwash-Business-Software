# Carwash SaaS

Multi-tenant car-wash management platform — Hono + Drizzle (libSQL/Turso) API,
React 19 + TanStack Router/Query + shadcn/ui web app, deployed with Coolify.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22+ (TypeScript, ESM) |
| API | Hono + Zod + Hono RPC |
| DB | libSQL / Turso via Drizzle ORM |
| Auth | Better Auth (self-hosted, Drizzle adapter) |
| Web | React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui |
| Validation | Zod (shared between API and web) |
| Observability | Pino structured logging |
| Deploy | Coolify + Docker Compose (Traefik HTTPS) |

## Layout

```
apps/
  api/                Hono API (routes, middleware, seed)
  web/                React SPA
packages/
  db/                 Drizzle schema, columns, client, tenant helpers
  shared/             Zod schemas + domain enums shared by api and web
docker-compose.yml    Coolify-ready services
```

## Quick start (any OS)

Prerequisites: Node 22+, pnpm 9+ (and Docker if you prefer containers).

```bash
pnpm install
# Create .env from the example (cp on macOS/Linux, copy on Windows)
cp .env.example .env

# Generate + apply the schema to the local libSQL file
pnpm --filter @carwash/db db:generate
pnpm --filter @carwash/db db:migrate

# Run API (http://localhost:3000) and web (http://localhost:5173) together
pnpm dev
```

A few environment details worth knowing:

- The API loads the nearest `.env` walking up from `apps/api`, so the single
  repo-root file works no matter which directory pnpm runs the script from.
  Real process environment variables (Coolify, Docker, CI, your shell) always
  win over values in the file.
- A relative `file:` URL such as `LIBSQL_URL=file:local.db` is resolved against
  `packages/db`, not the process working directory. That keeps the API and
  drizzle-kit pointed at the same file: `packages/db/local.db`.
- If port 3000 is already taken, change `PORT` (and `BETTER_AUTH_URL`) in `.env`
  and update the dev proxy target in `apps/web/vite.config.ts`, or set the
  `VITE_API_PROXY` environment variable when starting Vite.

The web app proxies `/api` to the API in dev. Signing up through the UI creates
your first business, including a starter location, bays, price list and services,
so the app is usable immediately. A user can belong to several businesses and
switch between them from the header.

Optional: seed the shared `demo` business and attach yourself as its owner:

```bash
pnpm --filter @carwash/api seed you@example.com
```

API docs: <http://localhost:3000/docs> · OpenAPI: `/api/openapi.json` · Health: `/api/health`.

## Multi-tenancy

- `tenants` = a car-wash business; `locations` = its branches.
- Self-serve onboarding creates the tenant, owner membership, trial subscription and
  starter data in one call (`POST /api/onboarding`); existing users can belong to
  several businesses and switch with the header selector.
- `users` = platform identity (Better Auth-compatible); `tenant_members` = role per tenant.
- Tenant-owned tables carry `tenant_id`; queries filter/stamp it explicitly via
  `@carwash/db` `createTenantDb`.
- Requests select the active business with `X-Tenant-Slug` (or `?tenant=`, `/t/<slug>`,
  or a verified custom domain). `requireTenantMember` verifies membership before any route runs.
- For hard isolation, `tenantDbFor()` in `apps/api/src/lib/db.ts` is the seam to switch to
  database-per-tenant.

## Using the Hono RPC client

The web app never duplicates API types:

```ts
import { api } from '@/lib/api';

const res = await api.api.customers.$get({ query: { page: '1', limit: '20' } });
const { data, meta } = await res.json(); // fully typed
```

## Coolify deployment

1. Push this repo to Git and add it in Coolify as a **Docker Compose** resource.
2. Set environment variables (Coolify → Environment):
   - `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` — your Turso database (or `file:/data/local.db`
     for the bundled volume).
   - `BETTER_AUTH_SECRET` — long random string (`openssl rand -base64 32`).
   - `BETTER_AUTH_URL` — public API URL, e.g. `https://api.example.com`.
   - `FRONTEND_URL` — public web URL, e.g. `https://app.example.com`.
   - `PUBLIC_API_URL` — same as `BETTER_AUTH_URL` (baked into the web build).
   - Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WHATSAPP_*`.
3. Assign domains: `api` → port 3000, `web` → port 80.
4. On first deploy, run migrations once:
   ```bash
   pnpm --filter @carwash/db db:migrate
   ```
   (Coolify → Terminal on the `api` container, or run it locally against Turso.)

Reminder: `VITE_API_URL`/`PUBLIC_API_URL` are compiled into the web bundle at build time —
change them only by rebuilding the `web` service.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run api + web in watch mode |
| `pnpm build` | Type-check/build all packages |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm lint` / `pnpm format` | Biome check / format |
| `pnpm test` | Vitest |
| `pnpm --filter @carwash/db db:generate` | Generate SQL migrations from the schema |
| `pnpm --filter @carwash/db db:migrate` | Apply migrations |
| `pnpm --filter @carwash/db db:studio` | Drizzle Studio |
| `pnpm --filter @carwash/api seed <email>` | Seed demo tenant + attach owner |
