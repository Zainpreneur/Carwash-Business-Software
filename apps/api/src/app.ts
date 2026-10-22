import { apiReference } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './env.js';
import { auth } from './lib/auth.js';
import { attachSession } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestLogger } from './middleware/request-logger.js';
import { resolveTenant } from './middleware/tenant.js';
import type { AppEnv } from './middleware/types.js';
import { apiRoutes } from './routes/index.js';

const base = new Hono<AppEnv>();

// --- Global middleware -----------------------------------------------------
base.use('*', requestLogger);
base.use('*', secureHeaders());
base.use(
  '*',
  cors({
    origin: [env.FRONTEND_URL],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
  })
);

// Route registrations must stay in a single chained expression: `app.route()`
// returns a new type, so calling it on a standalone variable would leave
// `typeof app` with a blank schema and break the RPC client types.
export const app = base
  // --- Health --------------------------------------------------------------
  .get('/api/health', (c) =>
    c.json({ status: 'ok', service: 'carwash-api', timestamp: new Date().toISOString() })
  )

  // --- Auth (Better Auth handles /api/auth/*) ------------------------------
  .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // --- API -----------------------------------------------------------------
  .use('/api/*', attachSession)
  .use('/api/*', resolveTenant)
  .route('/api', apiRoutes)

  // --- OpenAPI + docs ------------------------------------------------------
  .get('/api/openapi.json', (c) => c.json(openApiDoc))
  .get('/docs', apiReference({ spec: { url: '/api/openapi.json' } }))

  // --- Errors --------------------------------------------------------------
  .notFound(notFound)
  .onError(errorHandler);

// --- OpenAPI + docs --------------------------------------------------------
const openApiDoc = {
  openapi: '3.1.0',
  info: {
    title: 'Carwash SaaS API',
    version: '2.0.0',
    description:
      'Multi-tenant car-wash management API. Authenticate with Better Auth sessions; ' +
      'select the active business with the X-Tenant-Slug header (or ?tenant=).',
  },
  servers: [{ url: env.BETTER_AUTH_URL }],
  paths: {
    '/api/health': { get: { summary: 'Health check', tags: ['system'] } },
    '/api/auth/sign-up/email': { post: { summary: 'Sign up', tags: ['auth'] } },
    '/api/auth/sign-in/email': { post: { summary: 'Sign in', tags: ['auth'] } },
    '/api/auth/sign-out': { post: { summary: 'Sign out', tags: ['auth'] } },
    '/api/onboarding': {
      post: { summary: 'Create your first business with starter data', tags: ['onboarding'] },
    },
    '/api/users/me': {
      get: { summary: 'Get current user', tags: ['users'] },
      patch: { summary: 'Update current user', tags: ['users'] },
    },
    '/api/users/me/tenants': {
      get: { summary: 'List businesses you belong to', tags: ['users'] },
    },
    '/api/tenant': {
      get: { summary: 'Get current tenant', tags: ['tenant'] },
      patch: { summary: 'Update current tenant', tags: ['tenant'] },
    },
    '/api/tenant/locations': {
      get: { summary: 'List locations', tags: ['tenant'] },
      post: { summary: 'Create location', tags: ['tenant'] },
    },
    '/api/tenant/members': {
      get: { summary: 'List members', tags: ['tenant'] },
      post: { summary: 'Add member', tags: ['tenant'] },
    },
    '/api/customers': {
      get: { summary: 'List customers', tags: ['customers'] },
      post: { summary: 'Create customer', tags: ['customers'] },
    },
    '/api/customers/{id}': {
      get: { summary: 'Get customer', tags: ['customers'] },
      patch: { summary: 'Update customer', tags: ['customers'] },
      delete: { summary: 'Delete customer', tags: ['customers'] },
    },
    '/api/vehicles': {
      get: { summary: 'List vehicles', tags: ['vehicles'] },
      post: { summary: 'Create vehicle', tags: ['vehicles'] },
    },
    '/api/services': {
      get: { summary: 'List services', tags: ['services'] },
      post: { summary: 'Create service', tags: ['services'] },
    },
    '/api/bookings': {
      get: { summary: 'List bookings', tags: ['bookings'] },
      post: { summary: 'Create booking', tags: ['bookings'] },
    },
    '/api/wash-orders': {
      get: { summary: 'List wash orders', tags: ['wash-orders'] },
      post: { summary: 'Create wash order', tags: ['wash-orders'] },
    },
    '/api/wash-orders/board': { get: { summary: 'Wash-floor board', tags: ['wash-orders'] } },
    '/api/wash-orders/{id}/transition': {
      post: { summary: 'Advance order state', tags: ['wash-orders'] },
    },
    '/api/wash-orders/{id}/checkout': {
      post: { summary: 'Complete + checkout', tags: ['wash-orders'] },
    },
    '/api/wash-packages': {
      get: { summary: 'List wash packages', tags: ['wash-packages'] },
      post: { summary: 'Create wash package', tags: ['wash-packages'] },
    },
    '/api/service-bays': {
      get: { summary: 'List service bays', tags: ['service-bays'] },
      post: { summary: 'Create service bay', tags: ['service-bays'] },
    },
    '/api/membership-plans': {
      get: { summary: 'List membership plans', tags: ['membership'] },
      post: { summary: 'Create membership plan', tags: ['membership'] },
    },
    '/api/membership-subscriptions': {
      get: { summary: 'List memberships', tags: ['membership'] },
      post: { summary: 'Create membership', tags: ['membership'] },
    },
    '/api/tickets': {
      get: { summary: 'List tickets', tags: ['support'] },
      post: { summary: 'Create ticket', tags: ['support'] },
    },
    '/api/hr/employees': {
      get: { summary: 'List employees', tags: ['hr'] },
      post: { summary: 'Create employee', tags: ['hr'] },
    },
    '/api/hr/shifts': {
      get: { summary: 'List shifts', tags: ['hr'] },
      post: { summary: 'Create shift', tags: ['hr'] },
    },
    '/api/inventory/supplies': {
      get: { summary: 'List supplies', tags: ['inventory'] },
      post: { summary: 'Create supply', tags: ['inventory'] },
    },
    '/api/inventory/purchase-orders': {
      get: { summary: 'List purchase orders', tags: ['inventory'] },
      post: { summary: 'Create purchase order', tags: ['inventory'] },
    },
    '/api/dashboard/summary': { get: { summary: 'Dashboard KPIs', tags: ['dashboard'] } },
    '/api/public/bookings': { post: { summary: 'Public booking', tags: ['public'] } },
    '/api/saas/plans': { get: { summary: 'Public SaaS plans', tags: ['saas'] } },
    '/api/saas/admin/tenants': {
      get: { summary: 'List all tenants (platform admin)', tags: ['saas'] },
      post: { summary: 'Provision tenant (platform admin)', tags: ['saas'] },
    },
  },
};

/**
 * `.route()` returns `MergeSchemaPath<SubSchema> | S`, so a fully assembled app
 * has a *union* of partial schemas. Hono's RPC client needs one flat record, so
 * collapse the union into an intersection before exporting the app type.
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
type AppSchemaOf<T> = T extends Hono<any, infer S, any> ? S : never;
export type AppType = Hono<AppEnv, UnionToIntersection<AppSchemaOf<typeof app>>, '/'>;
