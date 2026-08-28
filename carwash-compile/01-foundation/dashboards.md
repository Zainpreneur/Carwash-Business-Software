# UI & Dashboards

*Part of the Foundation cluster. Compiled from `bir.json`.*

Seven human roles, each with a distinct floor-vs-desk view: the bay floor needs a queue board
glanceable from ten feet away, the back office needs P&L and payroll. Mobile-first for
anyone standing on the wash floor; desktop-first for anyone sitting at a screen.

---

## Owner

**Home view** (mobile-first, WhatsApp digest + light dashboard): health score, today's cars
washed, membership penetration, any open anomaly alert - nothing else. This is the "does the
business make sense at a glance" screen even at single-location scale.

**Forms**: `MembershipPlan` create/edit (name, tier, coveredPackageId, monthlyPrice,
isUnlimited select). `WashPackage`/`PackagePricing` create/edit.

**List/table views**: full `WashOrder` history (filterable by date/bay/package), full
`Employee` roster, `Asset` registry.

### Owner dashboard tiles
| KPI | Viz | Cadence | Alert |
|---|---|---|---|
| Business Health Score | number tile + trend | daily | - |
| cars-washed-per-day | number tile + trend line | real-time | - |
| membership-penetration-rate | number tile | daily | if drops >5pts week-over-week |
| net-membership-growth | number tile | daily | if negative for 3+ consecutive days |
| bay-utilization-rate | bar-by-bay | hourly | if <60% for 3 consecutive days -> notify owner (`05-automations-reminders.md`-style) |
| revenue-per-vehicle | trend line | daily | - |
| avg-review-rating | number tile | weekly | if drops below 4.3 |

---

## Site Manager

**Home view** (desktop-first at the back-office terminal, mobile-capable on the floor): live
queue depth by bay, any bay `operationalStatus != operational`, open `Ticket`s, today's
`Shift` coverage gaps, pending `PurchaseOrder`/`MaintenanceOrder` approvals.

**Forms**:
| Entity | Fields | Auto-filled vs manual |
|---|---|---|
| Shift | employeeId (select), bayId (select), startTime/endTime | manual |
| MaintenanceOrder approval | confirm-offline toggle | auto-drafted by `predictive-maintenance-agent`, manager confirms |
| PurchaseOrder approval | approve/edit line items | auto-drafted by `inventory-forecaster` above $150, manager approves |
| Ticket | category, priority | category auto-suggested by `review-response-agent`/`wash-concierge`, editable |

**List/table views**: today's `WashOrder` queue (default filter: not Completed/Cancelled,
sorted by queuedAt), open `Ticket`s (sorted by SLA breach risk), `Employee` roster for the
site.

### Site Manager dashboard tiles
| KPI | Viz | Cadence | Alert |
|---|---|---|---|
| avg-wait-time-minutes | number tile + trend | real-time | queue-wait-alert automation at >20min predicted |
| bay-status board | 6-tile grid (bay# / status / current WashOrder) | real-time | bay-down-reroute automation |
| technician-utilization | bar-by-technician | daily | - |
| equipment-uptime-rate | number tile | daily | anomaly rule if telemetry-flagged count doubles WoW |
| chemical-cost-per-wash | number tile + trend | weekly | anomaly rule if >15% WoW rise |

---

## Bay Attendant (mobile-first, field view)

**Home view**: the live queue (next 5 vehicles), which bay is open next, one-tap "log new
vehicle" button.

**Forms**: `WashOrder` create (vehicleId lookup-by-plate or new `Vehicle`, packageId select,
paymentMethod select - membership auto-detected via plate match).

**List/table views**: "my queue today" only, not the full order history.

**Tiles**: queue length, next-open-bay countdown. Nothing else - this is deliberately minimal
for a role standing outdoors, not sitting at a desk.

---

## Wash Technician (mobile-first, field view)

**Home view**: my assigned bay's current `WashOrder`, wash-cycle timer, one-tap qc-passed/
qc-failed action.

**Forms**: QC checklist (per `WashPackage.tier` - a `signature-full-service` checklist has
more line items than `express-exterior`). `MaintenanceOrder` progress update (partsUsed,
mark InProgress/Completed).

**Tiles**: my cycle-time average today vs. package norm (feeds `quality-anomaly-detector`'s
baseline transparently, not as a surveillance metric).

---

## Detail Technician (mobile-first, field view)

Same shape as Wash Technician, scoped to detail-bay `WashOrder`s and appointment schedule
(`scheduledFor` list for today) instead of the tunnel queue.

---

## Cashier (desktop-first, kiosk)

**Home view**: checkout queue (`ReadyForPickup` orders), membership-signup shortcut.

**Forms**: `MembershipSubscription` create (vehicle plate, plan select, payment token capture -
payment token field is never manually typed, always tokenized via the card reader). `Payment`
create (auto-filled amount from `WashOrder.price`, editable only for a manual discount within
guardrail).

**Tiles**: today's membership sign-ups, today's revenue split (membership vs. pay-per-wash vs.
fleet).

---

## Fleet Account Manager (desktop-first, part-time role)

**Home view**: flagged fleet leads (from `fleet-lead-scorer`), overdue fleet `Invoice`s.

**Forms**: `Invoice` create/edit for fleet net-15 billing, `Customer.isFleetAccount` /
`fleetLeadScore` review.

**Tiles**: fleet revenue trend, fleet AR aging.

---

## Layout conventions

Forms/dashboards are grouped by the same subdomain headers as the data model (Core /
Membership / Wash Floor / Staffing / Assets & Maintenance / Inventory / Finance / CRM &
Content) so a KPI on any dashboard traces straight back to the entity/fields producing it in
`01-foundation/data-model.md`. Component library is left implementation-agnostic here; see
`07-delivery/deployment-guide.md` for the recommended concrete stack.
