import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import type { AppEnv } from './types.js';

/**
 * Uniform error envelope: { error: { code, message, details? } }.
 * Logs server errors with the request id for correlation.
 */
export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get('requestId');

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: err.status === 404 ? 'not_found' : 'http_error', message: err.message } },
      err.status
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'validation_error',
          message: 'Request validation failed',
          details: err.flatten(),
        },
      },
      400
    );
  }

  // SQLite/libSQL unique constraint violations
  if (/UNIQUE constraint failed/i.test(err.message)) {
    return c.json(
      { error: { code: 'conflict', message: 'A record with those values already exists' } },
      409
    );
  }

  logger.error({ err, requestId }, 'unhandled error');
  return c.json(
    { error: { code: 'internal_error', message: 'Something went wrong', requestId } },
    500
  );
}

export function notFound(c: Context<AppEnv>): Response {
  return c.json(
    { error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` } },
    404
  );
}
