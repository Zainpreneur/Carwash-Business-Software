import { authAccounts, authSessions, authVerifications, users } from '@carwash/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '../env.js';
import { platformDb } from './db.js';

/**
 * Better Auth — self-hosted, multi-tenant friendly, Drizzle adapter.
 *
 * Identity lives in `users`; credentials/oauth in `auth_accounts`; sessions in
 * `auth_sessions`. App-specific fields are exposed as additional fields so they
 * round-trip through the session object.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(platformDb, {
    provider: 'sqlite',
    schema: {
      user: users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
    usePlural: false,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once/day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      platformRole: { type: 'string', defaultValue: 'user', input: false },
      phone: { type: 'string', required: false },
      active: { type: 'boolean', defaultValue: true, input: false },
      avatarColor: { type: 'string', defaultValue: '#2563eb', input: false },
    },
  },
  trustedOrigins: [env.FRONTEND_URL],
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
  },
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
