# Inventory & Supply Chain

*Part of the Operations cluster. Compiled from `bir.json`.*

Chemicals, tunnel/detail supplies, and disposables - not durable equipment, which is
`03-operations/assets-iot.md`'s domain.

---

## Stock tracking

`trackingMethod: sku-quantity` - a running quantity per `Supply` item is enough granularity;
no batch/lot tracking needed (chemicals aren't recall-relevant or individually serialized at
this scale).

## Warehouses

Two on-site storage rooms, not branches (single-location business): **Main Chemical Room**
(tunnel soap/wax/tire-shine concentrate, reclaim filter media) and **Detail Bay Storage**
(interior cleaner, microfiber towels, air freshener - detail-bay-specific consumables kept
separate so a detail-bay stockout doesn't get masked by chemical-room supply).

## Purchasing

`purchaseOrderEntity: PurchaseOrder`, state machine `Draft -> Sent -> PartiallyReceived ->
Received -> Closed`. `inventory-forecaster`'s reorder recommendations become a draft PO;
`site-manager` approves above the agent's $150 autonomous threshold; receiving a shipment
auto-updates `Stock` and posts the A/P journal entry per `05-finance/accounting.md`.

## Suppliers

| ID | Name | Lead time |
|---|---|---|
| `chem-supplier-primary` | Regional Car Wash Chemical Supply Co. | 4 days |
| `parts-supplier-equipment` | Tunnel Equipment Parts Distributor | 10 days |
| `towels-supplier` | Microfiber & Detailing Supplies Wholesaler | 5 days |

Parts lead time (10 days) is meaningfully longer than chemical lead time (4 days) - this
matters directly to `predictive-maintenance-agent`'s parts-pending path in
`assets-iot.md`: catching a bearing-wear trend 10+ days before failure is what actually makes
the parts-in-hand-before-breakdown promise real, not just aspirational.

## Reorder policy

"Reorder to a 30-day par level whenever on-hand drops below a 7-day average-consumption
supply, computed from trailing wash volume by package mix." Chemical consumption scales with
package mix, not just wash count - a week skewed toward `premium-hand-detail` consumes more
wax/interior-cleaner per wash than a week of mostly `express-exterior`, so the forecaster reads
`WashOrder.packageId` mix, not a flat per-vehicle average.

## Stock transfers

`stockTransfers: false` - single location, nothing to transfer between. Revisit if a second
site is added.

## Shrinkage & write-offs

`StockAdjustment` records reason code (`breakage`, `spillage`, `theft`, `expired`,
`count-correction`), always requiring `approvedBy` (an `Employee`, typically site-manager) -
same approval discipline as a discount/refund. Posts to `5700 Inventory Shrinkage Expense`
in `05-finance/accounting.md` rather than silently vanishing from the books. `expired` is the
most likely code in practice here (reclaim filter media and diluted chemical concentrate both
have a shelf life once opened).
