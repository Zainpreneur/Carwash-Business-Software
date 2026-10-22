import type { TenantRole } from '@carwash/shared/constants';
import { createMiddleware } from 'hono/factory';
import { auth } from '../lib/auth.js';
import type { AppEnv } from './types.js';

const ROLE_RANK: Record<TenantRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  staff: 1,
};

/** Populate `user`/`session` from the Better Auth session cookie, if present. */
export const attachSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session) {
    c.set('session', session.session);
    c.set('user', session.user);
  } else {
    c.set('session', null);
    c.set('user', null);
  }
  await next();
});

/** Reject when no authenticated user is attached. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: { code: 'unauthorized', message: 'Sign in required' } }, 401);
  }
  await next();
});

/** Require at least `min` role within the resolved tenant. */
export const requireRole = (min: TenantRole) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const tenant = c.get('tenant');
    if (!tenant?.role) {
      return c.json({ error: { code: 'forbidden', message: 'Tenant role required' } }, 403);
    }
    if (ROLE_RANK[tenant.role] < ROLE_RANK[min]) {
      return c.json(
        { error: { code: 'forbidden', message: `Requires ${min} role or higher` } },
        403
      );
    }
    await next();
  });

/** Platform operator only (SaaS console). */
export const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user || user.platformRole !== 'platform_admin') {
    return c.json({ error: { code: 'forbidden', message: 'Platform admin required' } }, 403);
  }
  await next();
});
