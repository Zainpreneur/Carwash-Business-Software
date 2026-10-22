import pino from 'pino';
import { env, isProd } from '../env.js';

/**
 * Structured JSON logger. In dev, pretty-print via pino-pretty.
 * In production, emit raw JSON for Loki/Grafana ingestion.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
  base: { service: 'carwash-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    censor: '[redacted]',
  },
});
