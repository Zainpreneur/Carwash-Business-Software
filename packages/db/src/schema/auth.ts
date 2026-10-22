import { index, sqliteTable, text, timestampMs, uid, uniqueIndex } from '../columns.js';
import { users } from './platform.js';

// ---------------------------------------------------------------------------
// Better Auth session/credential tables (libSQL dialect).
//
// The canonical identity record is `users` (see platform.ts), made Better-Auth
// compatible: id, name, email, emailVerified, image, createdAt, updatedAt, plus
// app-specific additional fields (platformRole, phone, active, avatarColor).
// These tables hold sessions, credential/oauth accounts, and verification tokens.
// ---------------------------------------------------------------------------

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: uid('id'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestampMs('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestampMs('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('idx_auth_sessions_user').on(t.userId)]
);

export const authAccounts = sqliteTable(
  'auth_accounts',
  {
    id: uid('id'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestampMs('access_token_expires_at'),
    refreshTokenExpiresAt: timestampMs('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestampMs('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('uq_auth_accounts_provider').on(t.providerId, t.accountId)]
);

export const authVerifications = sqliteTable(
  'auth_verifications',
  {
    id: uid('id'),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestampMs('expires_at').notNull(),
    createdAt: timestampMs('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestampMs('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('idx_auth_verifications_identifier').on(t.identifier)]
);
