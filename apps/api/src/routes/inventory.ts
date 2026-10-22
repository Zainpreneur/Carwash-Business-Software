import {
  locationStock,
  purchaseOrderLines,
  purchaseOrders,
  stockAdjustments,
  suppliers,
  supplies,
} from '@carwash/db/schema';
import {
  createPurchaseOrderSchema,
  createStockAdjustmentSchema,
  createSupplierSchema,
  createSupplySchema,
  receivePurchaseOrderSchema,
  updateSupplySchema,
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
  .use('*', requireRole('manager'))

  // --------------------------------- Suppliers ------------------------------

  .route(
    '/suppliers',
    createCrudRoutes({
      table: suppliers,
      idColumn: suppliers._id,
      searchColumns: [suppliers.name],
      sortable: { name: suppliers.name },
      createSchema: createSupplierSchema,
      updateSchema: createSupplierSchema.partial(),
      omitOnWrite: ['tenant'],
    })
  )

  // ---------------------------------- Supplies ------------------------------

  .route(
    '/supplies',
    createCrudRoutes({
      table: supplies,
      idColumn: supplies._id,
      searchColumns: [supplies.name, supplies.warehouse],
      sortable: { name: supplies.name, quantityOnHand: supplies.quantityOnHand },
      createSchema: createSupplySchema,
      updateSchema: updateSupplySchema,
      omitOnWrite: ['tenant'],
    })
  )

  // ------------------------------- Purchase orders --------------------------

  .get('/purchase-orders', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.tenant, tenant.id))
      .orderBy(purchaseOrders.createdAt);
    return c.json({ data: rows });
  })

  .get('/purchase-orders/:id', async (c) => {
    const tenant = c.get('tenant')!;
    const [po] = await platformDb
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenant, tenant.id), eq(purchaseOrders._id, c.req.param('id'))))
      .limit(1);
    if (!po) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    const lines = await platformDb
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrder, po._id));
    return c.json({ data: { ...po, lines } });
  })

  .post('/purchase-orders', zValidator('json', createPurchaseOrderSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const user = c.get('user')!;
    const input = c.req.valid('json');
    const total = input.lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0);

    const [po] = await platformDb
      .insert(purchaseOrders)
      .values({
        tenant: tenant.id,
        location: input.locationId ?? tenant.locationId,
        supplier: input.supplierId,
        totalAmount: Math.round(total * 100) / 100,
        createdBy: user.id,
      })
      .returning();
    if (!po) return c.json({ error: { code: 'internal_error', message: 'Insert failed' } }, 500);

    await platformDb.insert(purchaseOrderLines).values(
      input.lines.map((l) => ({
        tenant: tenant.id,
        purchaseOrder: po._id,
        supply: l.supplyId,
        quantityOrdered: l.quantityOrdered,
        unitCost: l.unitCost,
      }))
    );
    return c.json({ data: po }, 201);
  })

  .post(
    '/purchase-orders/:id/receive',
    zValidator('json', receivePurchaseOrderSchema),
    async (c) => {
      const tenant = c.get('tenant')!;
      const input = c.req.valid('json');

      const [po] = await platformDb
        .select()
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.tenant, tenant.id), eq(purchaseOrders._id, c.req.param('id'))))
        .limit(1);
      if (!po) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);

      let allReceived = true;
      for (const line of input.lines) {
        const [poLine] = await platformDb
          .select()
          .from(purchaseOrderLines)
          .where(
            and(
              eq(purchaseOrderLines.tenant, tenant.id),
              eq(purchaseOrderLines._id, line.lineId),
              eq(purchaseOrderLines.purchaseOrder, po._id)
            )
          )
          .limit(1);
        if (!poLine) continue;

        const received = poLine.quantityReceived + line.quantityReceived;
        if (received < poLine.quantityOrdered) allReceived = false;

        await platformDb
          .update(purchaseOrderLines)
          .set({ quantityReceived: received })
          .where(eq(purchaseOrderLines._id, poLine._id));

        // Increase stock levels (tenant total + per location when known).
        const [supply] = await platformDb
          .select()
          .from(supplies)
          .where(eq(supplies._id, poLine.supply))
          .limit(1);
        if (supply) {
          await platformDb
            .update(supplies)
            .set({
              quantityOnHand: supply.quantityOnHand + line.quantityReceived,
              updatedAt: new Date(),
            })
            .where(eq(supplies._id, supply._id));
        }

        if (po.location) {
          const [stock] = await platformDb
            .select()
            .from(locationStock)
            .where(
              and(eq(locationStock.location, po.location), eq(locationStock.supply, poLine.supply))
            )
            .limit(1);
          if (stock) {
            await platformDb
              .update(locationStock)
              .set({
                quantityOnHand: stock.quantityOnHand + line.quantityReceived,
                updatedAt: new Date(),
              })
              .where(eq(locationStock._id, stock._id));
          } else {
            await platformDb.insert(locationStock).values({
              tenant: tenant.id,
              location: po.location,
              supply: poLine.supply,
              quantityOnHand: line.quantityReceived,
            });
          }
        }
      }

      const [updated] = await platformDb
        .update(purchaseOrders)
        .set({
          status: allReceived ? 'received' : 'partially-received',
          receivedAt: allReceived ? new Date() : po.receivedAt,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders._id, po._id))
        .returning();

      return c.json({ data: updated });
    }
  )

  // ------------------------------ Stock adjustments -------------------------

  .get('/adjustments', async (c) => {
    const tenant = c.get('tenant')!;
    const rows = await platformDb
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.tenant, tenant.id))
      .orderBy(stockAdjustments.createdAt);
    return c.json({ data: rows });
  })

  .post('/adjustments', zValidator('json', createStockAdjustmentSchema), async (c) => {
    const tenant = c.get('tenant')!;
    const user = c.get('user')!;
    const input = c.req.valid('json');

    const [supply] = await platformDb
      .select()
      .from(supplies)
      .where(and(eq(supplies.tenant, tenant.id), eq(supplies._id, input.supplyId)))
      .limit(1);
    if (!supply) return c.json({ error: { code: 'not_found', message: 'Supply not found' } }, 404);

    const [adjustment] = await platformDb
      .insert(stockAdjustments)
      .values({
        tenant: tenant.id,
        location: input.locationId ?? tenant.locationId,
        supply: input.supplyId,
        quantityDelta: input.quantityDelta,
        reasonCode: input.reasonCode,
        notes: input.notes,
        approvedBy: input.approvedBy,
        createdBy: user.id,
      })
      .returning();

    const newQty = Math.max(0, supply.quantityOnHand + input.quantityDelta);
    await platformDb
      .update(supplies)
      .set({ quantityOnHand: newQty, updatedAt: new Date() })
      .where(eq(supplies._id, supply._id));

    // Mirror the delta onto location stock when the supply is location-tracked.
    if (input.locationId ?? tenant.locationId) {
      const locId = input.locationId ?? tenant.locationId!;
      const [stock] = await platformDb
        .select()
        .from(locationStock)
        .where(and(eq(locationStock.location, locId), eq(locationStock.supply, supply._id)))
        .limit(1);
      if (stock) {
        await platformDb
          .update(locationStock)
          .set({
            quantityOnHand: Math.max(0, stock.quantityOnHand + input.quantityDelta),
            updatedAt: new Date(),
          })
          .where(eq(locationStock._id, stock._id));
      }
    }

    return c.json({ data: adjustment }, 201);
  });
export default router;
