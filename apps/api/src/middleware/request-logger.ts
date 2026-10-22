import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger.js';
import type { AppEnv } from './types.js';

/** Assign a request id and log method/path/status/duration as structured JSON. */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  const start = performance.now();
  await next();
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      tenant: c.get('tenant')?.slug,
      userId: c.get('user')?.id,
    },
    'request'
  );
});
