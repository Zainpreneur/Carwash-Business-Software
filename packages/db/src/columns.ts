import { randomUUID } from 'node:crypto';
import {
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

/** UUID text primary key — libSQL has no native uuid type, so IDs are generated client-side. */
export const uid = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => randomUUID());

/** SQLite has no boolean column; store as INTEGER 0/1 mapped to/from JS booleans. */
export const bool = (name: string, config: { default?: boolean } = {}) =>
  integer(name, { mode: 'boolean', ...config });

/** SQLite has no timestamptz; store as INTEGER milliseconds since epoch, mapped to Date. */
export const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' });

/** SQLite has no jsonb; store as TEXT and serialize/deserialize at the column boundary. */
export const json = <T = unknown>(name: string) =>
  customType<{ data: T; driverData: string | null }>({
    dataType: () => 'text',
    toDriver: (value) => (value === null || value === undefined ? null : JSON.stringify(value)),
    fromDriver: (value) =>
      value === null || value === undefined
        ? (null as unknown as T)
        : typeof value === 'string'
          ? (JSON.parse(value) as T)
          : (value as T),
  })(name);

/** Standard created/updated timestamp pair. */
export const timestamps = {
  createdAt: timestampMs('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestampMs('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
};

export { index, integer, real, sqliteTable, text, uniqueIndex };
