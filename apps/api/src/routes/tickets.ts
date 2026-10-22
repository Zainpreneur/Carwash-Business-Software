import { ticketComments, tickets } from '@carwash/db/schema';
import {
  addTicketCommentSchema,
  createTicketSchema,
  updateTicketSchema,
} from '@carwash/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createCrudRoutes } from '../lib/crud.js';
import { platformDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireTenantMember } from '../middleware/tenant.js';
import type { AppEnv } from '../middleware/types.js';

const router = new Hono<AppEnv>()
  .use('*', requireAuth, requireTenantMember)

  // Support agents / managers handle tickets.
  .use('*', requireRole('manager'))

  .route(
    '/',
    createCrudRoutes({
      table: tickets,
      idColumn: tickets._id,
      searchColumns: [tickets.subject, tickets.description, tickets.category],
      sortable: {
        createdAt: tickets.createdAt,
        priority: tickets.priority,
        status: tickets.status,
      },
      createSchema: createTicketSchema,
      updateSchema: updateTicketSchema,
      omitOnWrite: ['tenant'],
    })
  )

  .get('/:id/comments', async (c) => {
    const tenant = c.get('tenant')!;
    const comments = await platformDb
      .select()
      .from(ticketComments)
      .where(
        and(eq(ticketComments.tenant, tenant.id), eq(ticketComments.ticket, c.req.param('id')))
      )
      .orderBy(ticketComments.createdAt);
    return c.json({ data: comments });
  })

  .post('/:id/comments', zValidator('json', addTicketCommentSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const user = c.get('user')!;
    const [ticket] = await platformDb
      .select()
      .from(tickets)
      .where(and(eq(tickets.tenant, tenant.id), eq(tickets._id, c.req.param('id'))))
      .limit(1);
    if (!ticket) return c.json({ error: { code: 'not_found', message: 'Ticket not found' } }, 404);

    const [comment] = await platformDb
      .insert(ticketComments)
      .values({
        tenant: tenant.id,
        ticket: ticket._id,
        author: user.id,
        authorType: 'staff',
        body: c.req.valid('json').body,
      })
      .returning();

    // First staff reply stamps firstRespondedAt.
    if (!ticket.firstRespondedAt) {
      await platformDb
        .update(tickets)
        .set({ firstRespondedAt: new Date(), updatedAt: new Date() })
        .where(eq(tickets._id, ticket._id));
    }
    return c.json({ data: comment }, 201);
  });
export default router;
