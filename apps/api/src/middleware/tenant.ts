import { tenantDomains, tenantMembers, tenants } from '@carwash/db/schema';
import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { platformDb } from '../lib/db.js';
import type { AppEnv, TenantContext } from './types.js';

/**
 * Resolve which tenant a request is about, from (in order):
 *   1. `X-Tenant-Slug` header
 *   2. `?tenant=` query param
 *   3. `/t/<slug>` path prefix
 *   4. custom domain (Host header)
 *
 * The resolved tenant is only a *candidate* — `requireTenantMember` verifies the
 * caller actually belongs to it. Tenant resolution alone grants no access.
 */
export const resolveTenant = createMiddleware<AppEnv>(async (c, next) => {
  let slug = c.req.header('x-tenant-slug') ?? c.req.query('tenant') ?? null;

  if (!slug) {
    const match = c.req.path.match(/^\/t\/([a-z0-9-]+)/i);
    if (match) slug = match[1] ?? null;
  }

  if (!slug) {
    const host = c.req.header('host')?.split(':')[0] ?? null;
    if (host && !host.includes('localhost')) {
      const [domain] = await platformDb
        .select()
        .from(tenantDomains)
        .where(eq(tenantDomains.domain, host))
        .limit(1);
      if (domain) {
        const [tenant] = await platformDb
          .select()
          .from(tenants)
          .where(eq(tenants._id, domain.tenant))
          .limit(1);
        if (tenant) slug = tenant.slug;
      }
    }
  }

  if (!slug) {
    await next();
    return;
  }

  const [tenant] = await platformDb
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug.toLowerCase()))
    .limit(1);

  if (tenant) {
    const ctx: TenantContext = {
      id: tenant._id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      currency: tenant.currency,
      timezone: tenant.timezone,
      taxRate: Number(tenant.taxRate),
      role: null,
      locationId: null,
    };
    c.set('tenant', ctx);
  }

  await next();
});

/**
 * Require that the authenticated user is an active member of the resolved tenant,
 * and attach their role + location scope.
 */
export const requireTenantMember = createMiddleware<AppEnv>(async (c, next) => {
  const tenant = c.get('tenant');
  const user = c.get('user');
  if (!tenant)
    return c.json({ error: { code: 'tenant_required', message: 'No tenant resolved' } }, 400);
  if (!user) return c.json({ error: { code: 'unauthorized', message: 'Sign in required' } }, 401);

  const [member] = await platformDb
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenant, tenant.id), eq(tenantMembers.user, user.id)))
    .limit(1);

  if (!member || member.status !== 'active') {
    return c.json(
      { error: { code: 'forbidden', message: 'You are not a member of this business' } },
      403
    );
  }

  c.set('tenant', {
    ...tenant,
    role: member.role as TenantContext['role'],
    locationId: member.location ?? null,
  });
  await next();
});
