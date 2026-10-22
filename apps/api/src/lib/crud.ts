import { paginationSchema } from '@carwash/shared/schemas';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../middleware/types.js';
import { platformDb } from './db.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrudOptions {
  /** Drizzle table (must have tenant + id columns). */
  table: any;
  /** Primary key column object, usually table._id or table.id. */
  idColumn: any;
  /** Columns searchable via ?search= */
  searchColumns?: any[];
  /** Columns allowed in ?sortBy= (defaults to createdAt). */
  sortable?: Record<string, any>;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  /** Optional transform on list rows. */
  serialize?: (row: any) => any;
  /** Fields to strip from create/update payloads (e.g. tenant). */
  omitOnWrite?: string[];
}

function cleanInput(input: Record<string, unknown>, omit: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (omit.includes(k)) continue;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** `.returning()` on an untyped table resolves to `any[] | ResultSet`; normalise it. */
function firstRow<T = Record<string, unknown>>(result: unknown): T | undefined {
  return Array.isArray(result) ? (result[0] as T | undefined) : undefined;
}

/**
 * Build standard tenant-scoped CRUD routes:
 *   GET    /            list (pagination + search + sort)
 *   GET    /:id         get one
 *   POST   /            create
 *   PATCH  /:id         update
 *   DELETE /:id         delete
 *
 * Every query is filtered by the active tenant from context; every insert is
 * stamped with it. The caller is expected to have run `requireTenantMember`.
 */
export function createCrudRoutes(opts: CrudOptions) {
  const {
    table,
    idColumn,
    searchColumns = [],
    sortable,
    createSchema,
    updateSchema,
    serialize = (r) => r,
    omitOnWrite = [],
  } = opts;

  const routes = new Hono<AppEnv>()

    .get('/', async (c) => {
      const tenant = c.get('tenant')!;
      const parsed = paginationSchema.safeParse(c.req.query());
      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid query',
              details: parsed.error.flatten(),
            },
          },
          400
        );
      }
      const { page, limit, search, sortBy, sortDir } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [eq(table.tenant, tenant.id)];
      if (search && searchColumns.length) {
        const likeTerm = `%${search}%`;
        const searchCond = or(...searchColumns.map((col) => like(col, likeTerm)));
        if (searchCond) conditions.push(searchCond);
      }
      const where = and(...conditions);

      const sortCol =
        (sortBy && sortable?.[sortBy]) ?? sortable?.createdAt ?? table.createdAt ?? idColumn;
      const orderBy = sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

      const [rows, counted] = await Promise.all([
        platformDb.select().from(table).where(where).orderBy(orderBy).limit(limit).offset(offset),
        platformDb.select({ count: sql<number>`count(*)` }).from(table).where(where),
      ]);

      const total = Number(counted[0]?.count ?? 0);
      return c.json({
        data: rows.map(serialize),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    })

    .get('/:id', async (c) => {
      const tenant = c.get('tenant')!;
      const [row] = await platformDb
        .select()
        .from(table)
        .where(and(eq(table.tenant, tenant.id), eq(idColumn, c.req.param('id'))))
        .limit(1);
      if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ data: serialize(row) });
    })

    .post('/', async (c) => {
      const tenant = c.get('tenant')!;
      const body = await c.req.json().catch(() => null);
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid body',
              details: parsed.error.flatten(),
            },
          },
          400
        );
      }
      const values = {
        ...cleanInput(parsed.data as Record<string, unknown>, omitOnWrite),
        tenant: tenant.id,
      };
      const row = firstRow(await platformDb.insert(table).values(values).returning());
      return c.json({ data: serialize(row) }, 201);
    })

    .patch('/:id', async (c) => {
      const tenant = c.get('tenant')!;
      const body = await c.req.json().catch(() => null);
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: 'Invalid body',
              details: parsed.error.flatten(),
            },
          },
          400
        );
      }
      const values = {
        ...cleanInput(parsed.data as Record<string, unknown>, omitOnWrite),
        updatedAt: new Date(),
      };
      const row = firstRow(
        await platformDb
          .update(table)
          .set(values)
          .where(and(eq(table.tenant, tenant.id), eq(idColumn, c.req.param('id'))))
          .returning()
      );
      if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ data: serialize(row) });
    })

    .delete('/:id', async (c) => {
      const tenant = c.get('tenant')!;
      const row = firstRow(
        await platformDb
          .delete(table)
          .where(and(eq(table.tenant, tenant.id), eq(idColumn, c.req.param('id'))))
          .returning()
      );
      if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      return c.json({ ok: true });
    });

  return routes;
}
