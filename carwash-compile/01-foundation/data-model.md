# Data Model & Workflows

*Part of the Foundation cluster. Compiled from `bir.json`.*

SplashPoint Express Wash's model centers on `WashOrder` (a vehicle's trip through the wash)
and `MembershipSubscription` (the recurring-revenue backbone of a modern car wash) - almost
every other entity exists to feed, price, staff, or bill against one of those two. Audit
fields (`createdAt`, `updatedAt`, `createdBy`) are implied on every entity below and not
repeated per table.

---

## Core

### Customer
| Field | Type | Notes |
|---|---|---|
| id | string | |
| fullName | string | required |
| phone | string | **piiOrSensitive**, required |
| email | string | **piiOrSensitive** |
| preferredLanguage | enum(en, es) | drives WhatsApp/voice language |
| marketingConsent | boolean | required - gates MARKETING-category messaging |
| whatsappOptIn | boolean | required - gates transactional WhatsApp |
| paymentMethodToken | string | **piiOrSensitive** - Stripe token, never a raw card number |
| loyaltyPoints | number | |
| isFleetAccount | boolean | flags the small commercial segment |
| fleetLeadScore | number | computed by `fleet-lead-scorer` |
| referralCode | string | |
| referredByCode | string | |

### Vehicle
| Field | Type | Notes |
|---|---|---|
| customerId | relation -> Customer | required, many-to-one |
| vehicleType | enum(sedan-coupe, suv-truck, van-oversized) | drives `PackagePricing` |
| licensePlate | string | **piiOrSensitive**, required - tunnel plate-recognition key |
| make / model / color | string | |
| lastWashAt | datetime | |

**Relationships**: `Vehicle.customerId -> Customer` (many-to-one: a customer can register
several vehicles). `MembershipSubscription.vehicleId -> Vehicle` (one-to-one active at a time
- a plan covers one plate).

### WashPackage
| Field | Type | Notes |
|---|---|---|
| tier | enum(express-exterior, exterior-plus, signature-full-service, premium-hand-detail) | |
| deliveryLane | enum(tunnel, detail-bay) | express-exterior/exterior-plus run the tunnel; the top two tiers run the detail bays |
| includesInterior | boolean | |
| avgCycleTimeMinutes | number | required - the queue simulator's core input |

### PackagePricing (join entity)
`WashPackage` x vehicle size is many-to-many on price, so this join entity exists rather than
a flat price field on `WashPackage`: `PackagePricing.packageId -> WashPackage`,
`PackagePricing.vehicleType` (enum, mirrors `Vehicle.vehicleType`), `price` (money).

---

## Membership

### MembershipPlan
| Field | Type | Notes |
|---|---|---|
| tier | enum(basic-unlimited, premium-unlimited, fleet-unlimited) | |
| coveredPackageId | relation -> WashPackage | which package tier the plan entitles |
| monthlyPrice | money | |
| isUnlimited | boolean | |
| washesPerMonthCap | number | null when unlimited |
| rolloverAllowed | boolean | |

### MembershipSubscription
`customerId -> Customer`, `vehicleId -> Vehicle` (plate-linked), `planId -> MembershipPlan`,
`billingDayOfMonth`, `nextBillingDate`, `pausedUntil`, `washesThisCycle` (feeds the
wash-through-rate KPI), `failedPaymentAttempts`.

**State machine** (terminal: `Cancelled`):

| From | To | Trigger |
|---|---|---|
| Active | PastDue | billing-charge-failed |
| PastDue | Active | payment-retry-succeeded |
| PastDue | Suspended | past-due-7-days-unresolved |
| Suspended | Cancelled | suspended-30-days-no-payment |
| Suspended | Active | payment-collected-manually |
| Active | Paused | customer-requested-pause |
| Paused | Active | pause-period-ended |
| Active | Cancelled | customer-cancelled |

---

## Wash Floor

### ServiceBay
`bayNumber`, `bayType` enum(tunnel-conveyor, detail-bay), `operationalStatus` enum(operational,
degraded, down, retired), `currentWashOrderId -> WashOrder`, `avgThroughputPerHour`. Bays 1-4
are tunnel-conveyor positions; bays 5-6 are discrete detail stalls.

### WashOrder (primary lifecycle entity)
| Field | Type | Notes |
|---|---|---|
| customerId | relation -> Customer | nullable - anonymous walk-in cash wash allowed |
| vehicleId | relation -> Vehicle | required |
| packageId | relation -> WashPackage | required |
| subscriptionId | relation -> MembershipSubscription | nullable |
| bayId | relation -> ServiceBay | nullable until assigned |
| assignedTechnicianId | relation -> Employee | |
| bookingType | enum(walk-in, appointment) | required |
| scheduledFor | datetime | detail-bay appointments only |
| queuePosition / queuedAt / bayAssignedAt / washStartedAt / washCompletedAt | number/datetime | queue-analytics backbone |
| qcResult | enum(pass, fail) | set by a human technician, never by the quality-anomaly-detector agent |
| price | money | required |
| paymentMethod | enum(membership, card, cash, fleet-invoice) | |
| promoCode | string | attribution tie-back |

**State machine** (terminal: `Completed`, `Cancelled`):

| From | To | Trigger |
|---|---|---|
| Queued | BayAssigned | bay-assigned |
| BayAssigned | InWash | wash-cycle-started |
| InWash | QualityCheck | wash-cycle-complete |
| QualityCheck | ReadyForPickup | qc-passed |
| QualityCheck | InWash | qc-failed-rework |
| ReadyForPickup | Completed | checkout-confirmed |
| Queued | Cancelled | customer-cancelled |
| BayAssigned | Cancelled | no-show |

The `qc-failed-rework` loop back into `InWash` is deliberate, not a dead end - a rework wash
still exits through the same QC gate rather than a shortcut to `ReadyForPickup`.

---

## Staffing

### Employee
`fullName`, `role` enum(site-manager, bay-attendant, wash-technician, detail-technician,
cashier, fleet-account-manager), `hireDate`, `hourlyRate` (**piiOrSensitive**),
`certifications` (json), `emergencyContact` (**piiOrSensitive**), `employmentStatus`
enum(applicant, hired, onboarding, active, on-leave, offboarded).

### Shift
`employeeId -> Employee`, `bayId -> ServiceBay` (optional pin), `startTime`, `endTime`,
`status` enum(scheduled, confirmed, no-show, completed).

---

## Assets & Maintenance

### Asset
`assetType` enum(tunnel-conveyor-motor, foam-applicator-arch, water-reclaim-ro-system,
air-compressor, water-heater-boiler, dryer-blower-bank, vacuum-station), `bayId -> ServiceBay`,
`status` enum(operational, degraded, down, retired), `purchaseDate`, `warrantyExpiry`. See
`03-operations/assets-iot.md` for telemetry and predictive maintenance.

### MaintenanceOrder
`assetId -> Asset`, `triggeredBy` enum(scheduled, predictive), `triggeringSignal` (string),
`technicianId -> Employee`, `partsUsed` (json), `estimatedDowntimeCost` (money).

**State machine** (terminal: `Completed`):

| From | To | Trigger |
|---|---|---|
| Requested | PartsPending | parts-needed-not-in-stock |
| Requested | Scheduled | parts-in-stock-scheduled |
| PartsPending | Scheduled | parts-received |
| Scheduled | InProgress | technician-started |
| InProgress | Completed | service-completed |

---

## Inventory

### Supply
`name`, `category` enum(soap-detergent, wax-sealant, tire-shine, microfiber-towels,
air-freshener, interior-cleaner, reclaim-filter-media), `unit` enum(gallon, case, each),
`reorderThreshold`, `costPerUnit`.

### Warehouse
`name` - two on-site storage rooms (`Main Chemical Room`, `Detail Bay Storage`), not branches.

### Stock (join entity)
`itemId -> Supply`, `warehouseId -> Warehouse`, `quantity`. Location-specific so the detail-bay
storage running low doesn't hide a full chemical room, and vice versa.

### Supplier
`name`, `leadTimeDays`.

### PurchaseOrder
`supplierId -> Supplier`, `lineItems` (json), `orderedAt`, `expectedDate`, `totalCost`.

**State machine** (terminal: `Closed`):

| From | To | Trigger |
|---|---|---|
| Draft | Sent | po-sent-to-supplier |
| Sent | PartiallyReceived | partial-shipment-received |
| Sent | Received | full-shipment-received |
| PartiallyReceived | Received | remaining-shipment-received |
| Received | Closed | po-reconciled |

### StockAdjustment
`itemId -> Supply`, `warehouseId -> Warehouse`, `quantityChange`, `reasonCode` enum(breakage,
spillage, theft, expired, count-correction), `approvedBy -> Employee` - always required, same
approval discipline as a refund.

---

## Finance

### Invoice
`customerId -> Customer`, `washOrderId -> WashOrder`, `subscriptionId ->
MembershipSubscription`, `amount`, `dueDate`.

**State machine** (terminal: `Paid`, `Void`):

| From | To | Trigger |
|---|---|---|
| Draft | Sent | invoice-issued |
| Sent | Paid | payment-received |
| Sent | Overdue | due-date-passed-unpaid |
| Overdue | Paid | payment-received-late |
| Sent | Void | invoice-voided |

*(`validate_bir.py`'s dead-end check flags one non-last terminal state per entity when an
entity has two legitimate terminal states, since it only exempts the last item in the
`states` array - both `Paid` and `Void` are genuinely terminal here; see `qa-report.md`.)*

### Payment
`invoiceId -> Invoice`, `subscriptionId -> MembershipSubscription`, `amount`, `method`
enum(card, cash, ach, apple-pay, google-pay), `processorTxnId` (**piiOrSensitive**), `paidAt`.

### JournalEntry / JournalLine
`JournalEntry`: `date`, `memo`, `sourceEntity`, `sourceId` (traces every entry back to the
transaction that created it). `JournalLine`: `journalEntryId -> JournalEntry`, `accountCode`,
`debit`, `credit`. See `05-finance/accounting.md`.

---

## CRM & Content

### Ticket
`customerId -> Customer`, `washOrderId -> WashOrder`, `subject`, `category`
enum(damage-claim, billing-dispute, quality-complaint, membership-question, general),
`priority` enum(low, normal, high, urgent).

**State machine** (terminal: `Closed`):

| From | To | Trigger |
|---|---|---|
| Open | InProgress | assigned-to-staff |
| InProgress | WaitingOnCustomer | awaiting-customer-response |
| WaitingOnCustomer | InProgress | customer-responded |
| InProgress | Resolved | issue-resolved |
| Resolved | Closed | closed-after-grace-period |
| WaitingOnCustomer | Closed | no-response-14-days |

### SocialPost
`platform`, `pillar`, `scheduledFor`, `status` enum(draft, pending-approval, scheduled,
published), `assetRefs` (json), `caption`.

---

## Workflows

### `wash-a-vehicle` (primary lifecycle)
**Trigger**: vehicle arrives on site (walk-in) or an appointment's scheduled time is reached.

| Step | Actor | Action | Entity | On Failure |
|---|---|---|---|---|
| queue-entry | bay-attendant (human) | Log vehicle, select package, verify membership plate or take payment method | WashOrder | Manual name/phone search on plate-lookup miss; falls back to new walk-in |
| auto-assign-bay | `queue-dispatch-agent` (automatable, live) | Assign next open bay/technician balancing queue and package-to-lane fit | WashOrder | No bay in 10 min -> escalate to site-manager for overflow |
| run-wash-cycle | wash-technician (human) | Load tunnel or begin detail-bay service | WashOrder | Fault triggers `bay-down-reroute` automation |
| quality-check | wash-technician (human, `quality-anomaly-detector` flags outliers first) | Visual QC against package checklist | WashOrder | `qc-failed-rework` sends back through InWash, no extra charge |
| checkout | cashier (human) | Confirm membership verification or collect payment | WashOrder | Card decline -> manual retry/cash fallback |
| notify-ready | `wash-concierge` (automatable, live) | Send ready-for-pickup notification if opted in | WashOrder | Silently skip if no opt-in - not a hard failure |

### `enroll-membership`
**Trigger**: customer signs up for an unlimited plan (kiosk, WhatsApp, or online).
cashier captures vehicle plate + payment token -> creates `MembershipSubscription` (Active) ->
`wash-concierge` sends welcome message with plate-verification explainer.

### `cancel-refund-wash`
**Trigger**: pre-wash cancellation or a post-wash quality dispute.
bay-attendant cancels no-charge if still Queued/BayAssigned -> `wash-concierge` offers a free
rework within guardrail, opens a `Ticket` for anything beyond that -> site-manager approves
any refund above the agent's autonomous threshold; if unactioned, the `Ticket`'s
`billing-dispute`/`quality-complaint` SLA reminder (`04-growth/crm.md`) escalates further
before the SLA is actually missed.

### `onboard-employee`
**Trigger**: a new hire's start date arrives. site-manager creates the `Employee` record,
schedules a first `Shift` paired with a senior technician, grants RBAC access per
`01-foundation/security.md`.

### `reorder-supplies`
**Trigger**: `Stock.quantity` crosses `reorderThreshold`, or the nightly forecast run.
`inventory-forecaster` drafts a `PurchaseOrder` -> site-manager approves above the agent's spend
threshold -> bay-attendant receives shipment, updates `Stock`. See `03-operations/inventory.md`.

### `escalate-complaint`
**Trigger**: a negative review, a damage claim, or negative-sentiment WhatsApp message.
`review-response-agent` classifies and opens a `Ticket` for anything beyond a thank-you-worthy
positive mention -> site-manager reviews and responds directly; an SLA-breach reminder fires if
untouched past target.

### `predictive-maintenance-cycle`
**Trigger**: IoT telemetry on a monitored `Asset` drifts outside its normal range.
`predictive-maintenance-agent` detects drift -> auto-opens a `MaintenanceOrder` (pulling parts
from `Stock` or generating a `PurchaseOrder`) -> site-manager confirms taking the asset offline
during business hours (skipped if already failed/unsafe) -> wash-technician services it; if
the repair doesn't resolve the flagged fault, the `MaintenanceOrder` reopens to `Scheduled`
with an escalation note rather than closing, and a second failed attempt notifies
site-manager directly rather than looping silently. See `03-operations/assets-iot.md`.

Minimum workflow set coverage: primary lifecycle ✅, cancellation/refund ✅, staff onboarding ✅,
inventory reorder ✅, escalation/complaint ✅. New-customer onboarding is folded into
`wash-a-vehicle`'s `queue-entry` step (a first-time customer is captured the same way as a
repeat one, walk-in retail doesn't warrant a separate onboarding flow) and into
`enroll-membership` for anyone converting to a plan.
