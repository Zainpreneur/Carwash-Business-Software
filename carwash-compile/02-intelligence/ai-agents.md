# AI Agents & Reasoning

*Part of the Intelligence cluster. Compiled from `bir.json`.*

Twelve agents: one orchestrator, two advisors (strategy + system-health), seven specialists,
two task agents. Sized for a single site with a real amount of moving equipment and a
membership base to protect - not a chain, so no per-branch agent duplication, but enough
distinct judgment calls (queueing, billing, predictive maintenance, front-of-house) that a
flat list would blur who owns what.

---

## Orchestrator

### `ops-orchestrator`
- **Purpose**: Holds the day's operating picture across the wash floor (queue depth, bay
  status, staffing, open escalations) and routes work to the right specialist rather than each
  agent polling blind.
- **Triggers**: every 5 minutes during operating hours; any specialist agent escalation.
- **Tools**: `WashOrder.read`, `ServiceBay.read`, `Shift.read`, `notify_role`,
  `analytics.query`.
- **Touches**: WashOrder, ServiceBay, Shift.
- **Guardrails**: never overrides a specialist's guardrail (e.g. cannot approve a refund on
  `membership-billing-agent`'s behalf) - routing only, no independent transactional authority.
- **Escalates to**: `site-manager`.

---

## Advisor agents (the Business Reasoning Layer)

### `strategy-advisor` (reports to `ops-orchestrator`)
- **Purpose**: Answers open-ended owner questions - "should we add a 5th tunnel bay," "why did
  membership churn spike in July," "is the premium tier worth the price gap" - with a
  structured, traceable recommendation instead of a bare opinion.
- **Reasoning patterns**: `unit-economics` (membership plan profitability, marketing spend
  questions), `scenario-comparison` (runs 2+ named `simulation.md` scenarios side by side for
  capacity/pricing questions), `root-cause-5-whys` (chained from an analytics anomaly to its
  cause before recommending anything), `decision-matrix` (comparing 3+ discrete options, e.g.
  which chemical supplier to switch to).
- **Triggers**: owner asks a question via the Executive View or WhatsApp; a health-score or
  anomaly alert crosses a severity threshold worth investigating.
- **Tools**: `analytics.query`, `financial_model`, `web_search`, `Asset.read`,
  `MembershipSubscription.read`.
- **Touches**: WashOrder, MembershipSubscription, Asset, Employee.
- **Memory**: remembers prior recommendations and their stated confidence for 12 months, so it
  flags rather than silently contradicts an earlier stance (e.g. "I recommended against a 5th
  bay in March at 62% bay utilization; utilization is now 81% - worth revisiting").
- **Guardrails**: never commits to a lease, hire, price change, or equipment purchase - output
  is always a recommendation with confidence and a suggested cheap experiment (e.g. "trial the
  10% price increase on new sign-ups only for 30 days before repricing existing members"),
  routed to `owner`.
- **Escalates to**: `owner`.

**Example structured recommendation** (illustrating the format, not a live output):
> *Question*: "Why did membership churn spike in July?"
> *Pattern used*: root-cause-5-whys, drawing on the `chemical-cost-per-wash` anomaly and the
> `equipment-uptime-rate` dip that same month.
> *Data*: 14 cancellations in the week of Jul 14-20 (vs. 6/week trailing average), concurrent
> with the tunnel conveyor motor's `bay-down-reroute` firing 4 times that week for unplanned
> downtime (before the sensor platform was installed - a pre-IoT blind spot).
> *Recommendation*: the churn spike correlates with wait-time complaints during conveyor
> downtime, not price or competition. Confidence: 65% (correlation, not proven causation -
> only 4 downtime events to compare against).
> *Suggested experiment*: cross-reference the newly online `predictive-maintenance-agent`'s
> downtime log against the next churn cohort once 8+ weeks of sensor data exist, per
> `data-aggregation.md`'s `downtime-cost-with-telemetry-lead-time` analysis.
> *Next step*: routed to `owner` for awareness only - no action required yet, this is a
> lead worth re-checking, not a decision to make on 4 data points.

### `system-health-agent` (reports to `ops-orchestrator`)
- **Purpose**: Watches the AI workforce's own operating data - never customers or transactional
  entities - and produces a weekly health report naming what's healthy, what's drifting, and a
  concrete threshold fix per issue.
- **Reasoning patterns**: `root-cause-5-whys`.
- **Triggers**: weekly, Monday 6am before the site opens.
- **Tools**: `agent_metrics.read`, `analytics.query`, `notify_role`.
- **Touches**: none (operational metadata only, no BIR business entities).
- **Guardrails**: recommends threshold/config changes only - never self-modifies another
  agent's guardrails; every change routes through `escalatesTo` for a human decision.
- **Escalates to**: `site-manager`.
- **Sample finding it's built to surface**: "`wash-concierge` escalated 41% of conversations
  to site-manager this week, above the ~20% target - traced to low confidence on detail-bay
  appointment rescheduling during the week the premium-detail promo launched. Recommendation:
  add promo-specific rescheduling FAQ content to the knowledge base rather than lowering the
  confidence threshold (a lowered threshold would let the agent guess on a paid-service
  reschedule, which is the wrong fix)."

---

## Specialist agents

### `queue-dispatch-agent`
- **Purpose**: Assigns each queued vehicle to the next appropriate open bay (respecting
  tunnel-vs-detail-bay package fit) and technician, and predicts wait time so `wash-concierge`
  can tell a customer a real number instead of "soon."
- **Triggers**: `WashOrder` created (Queued); `ServiceBay.currentWashOrderId` clears (bay
  frees up); `Asset` status change on a bay's equipment.
- **Tools**: `WashOrder.read`, `WashOrder.update`, `ServiceBay.read`, `Employee.read`,
  `whatsapp.send`, `analytics.query`.
- **Touches**: WashOrder, ServiceBay.
- **Guardrails**: never reprioritizes a fleet vehicle ahead of an earlier-queued walk-in
  without an explicit fleet SLA rule on file; escalates to `site-manager` if predicted wait
  exceeds 25 minutes for 3 consecutive vehicles (open self-serve overflow or call in an extra
  bay-attendant).
- **Escalates to**: `site-manager`.

### `wash-concierge`
- **Purpose**: Membership sign-up, order-status lookup ("where's my car"), rebooking a detail
  appointment, and FAQ (guarantee/rework policy, hours, pricing) over WhatsApp.
- **Triggers**: inbound WhatsApp message; `WashOrder` status change for an opted-in customer.
- **Tools**: `whatsapp.send`, `WashOrder.read`, `MembershipSubscription.read`,
  `MembershipSubscription.create`, `MembershipPlan.read`, `knowledge_base.search`,
  `automation.trigger`.
- **Touches**: WashOrder, Customer, MembershipSubscription, Ticket.
- **Memory**: per-customer conversation history retained 90 days, so a repeat question isn't
  answered from scratch.
- **Guardrails**: never modifies pricing; can offer a free rework wash at $0 cost without
  approval, but any cash refund request over $15 is escalated to `site-manager`, never
  processed autonomously; escalates immediately on negative sentiment or a damage-claim
  mention, or below 70% confidence on any request outside FAQ/booking/status.
- **Escalates to**: `site-manager`.

### `membership-billing-agent`
- **Purpose**: Runs the monthly membership billing cycle, retries failed charges, and manages
  the past-due/suspension/pause lifecycle on `MembershipSubscription`.
- **Triggers**: `Subscription.nextBillingDate` reached; payment-processor webhook
  (charge succeeded/failed).
- **Tools**: `MembershipSubscription.read`, `MembershipSubscription.update`, `Payment.read`,
  `whatsapp.send`, `email.send`, `automation.trigger`.
- **Touches**: MembershipSubscription, Payment, Invoice.
- **Guardrails**: never cancels a membership before 3 failed retry attempts spread over 7
  days; never charges a stored payment method without documented consent on file at signup;
  suspension (not cancellation) is the automatic outcome of unresolved past-due status.
- **Escalates to**: `site-manager`.

### `inventory-forecaster`
- **Purpose**: Predicts chemical/consumable usage (soap, wax, tire shine, microfiber towels,
  reclaim filter media) from rolling wash volume and package mix, flags reorder points, and
  drafts purchase orders.
- **Triggers**: nightly schedule; `Stock.quantity` crossing `Supply.reorderThreshold`.
- **Tools**: `Supply.read`, `Stock.read`, `WashOrder.read`, `PurchaseOrder.create`,
  `automation.trigger`.
- **Touches**: Supply, Stock, PurchaseOrder.
- **Guardrails**: auto-approves and sends POs under $150; anything above requires
  `site-manager` sign-off before the PO leaves Draft.
- **Escalates to**: `site-manager`.

### `predictive-maintenance-agent` — the headline IoT agent
- **Purpose**: Watches IoT telemetry (vibration, motor current draw, temperature, water
  flow-rate/turbidity, blower RPM, compressor pressure) on the tunnel conveyor motor, water
  reclaim system, boiler, air compressor, and dryer blowers, distinguishes slow bearing/filter
  drift from a sudden fault spike, and auto-opens a `MaintenanceOrder` before hard failure -
  see `03-operations/assets-iot.md` for the full telemetry table and reasoning detail.
- **Triggers**: continuous telemetry stream, evaluated every 60 seconds against each asset's
  learned normal operating range.
- **Tools**: `iot.read_telemetry`, `Asset.read`, `Asset.update`, `MaintenanceOrder.create`,
  `Stock.read`, `PurchaseOrder.create`, `notify_role`.
- **Touches**: Asset, MaintenanceOrder, Stock, PurchaseOrder.
- **Guardrails**: can create/schedule a `MaintenanceOrder` and request parts autonomously;
  taking equipment offline during business hours requires `site-manager` confirmation *unless*
  the asset has already failed or is unsafe to keep running (e.g. boiler over-temperature), in
  which case it takes the asset offline immediately and notifies `site-manager` after the
  fact.
- **Escalates to**: `site-manager`.

### `review-response-agent`
- **Purpose**: Monitors Google Business Profile and social mentions, auto-thanks simple
  positive reviews with a loyalty-point offer, and opens a `Ticket` + immediate site-manager
  alert for anything negative or mentioning damage.
- **Triggers**: new review or mention detected.
- **Tools**: `web_search`, `Ticket.create`, `notify_role`, `Customer.update`.
- **Touches**: Ticket, Customer.
- **Guardrails**: never auto-responds to a review below 4 stars or one mentioning
  damage/injury/billing - always escalated to `site-manager`, never auto-replied.
- **Escalates to**: `site-manager`.

### `phone-line-agent` — the voice channel
- **Purpose**: Answers and triages inbound calls (hours, membership pricing, fleet inquiries),
  transcribes and summarizes the call onto the relevant `Customer`/`Ticket` record, and can
  place outbound calls for a high-value fleet callback or an overdue-payment call escalated
  from `membership-billing-agent`. Phone is one more channel into the same customer
  conversation history as WhatsApp - a customer who called yesterday and messages today
  shouldn't have to repeat themselves (shares `wash-concierge`'s 90-day memory window via the
  same `Customer` record).
- **Triggers**: inbound phone call; outbound-call handoff from `membership-billing-agent` or
  `fleet-lead-scorer`.
- **Tools**: `voice.call`, `voice.transcribe`, `Ticket.create`, `Customer.read`, `notify_role`.
- **Touches**: Customer, Ticket.
- **Guardrails**: never collects or reads back full payment card details over the phone -
  directs the caller to the kiosk, a WhatsApp payment link, or a human for anything requiring
  card entry; escalates anything beyond hours/pricing/FAQ to a human immediately, same
  threshold as `wash-concierge`.
- **Escalates to**: `site-manager`.

---

## Task agents

### `quality-anomaly-detector`
- **Purpose**: Flags a wash cycle whose duration is statistically too fast (a likely skipped
  step) or too slow (a likely jam) compared to that package's normal cycle time, routing it to
  a human wash-technician glance before checkout - it never sets `qcResult` itself.
- **Triggers**: `WashOrder` transitions `InWash -> QualityCheck`.
- **Tools**: `WashOrder.read`, `iot.read_telemetry`, `notify_role`.
- **Touches**: WashOrder.
- **Guardrails**: never blocks checkout on its own - flags for a human glance only; `qcResult`
  is always set by a person.
- **Escalates to**: `site-manager`.

### `fleet-lead-scorer`
- **Purpose**: Scores an inbound commercial/fleet inquiry (vehicle count requested,
  business-hours contact pattern, invoicing-terms request) and creates a follow-up
  notification for `fleet-account-manager`, rather than running a full sales pipeline - most
  fleet interest here is a handful of local businesses, not a sales org (see
  `04-growth/crm.md` for why the full pipeline was skipped).
- **Triggers**: `Customer.isFleetAccount` flagged true, or a WhatsApp/phone inquiry mentions
  multiple vehicles.
- **Tools**: `Customer.read`, `Customer.update`, `notify_role`.
- **Touches**: Customer.
- **Guardrails**: never commits to custom fleet pricing - always a human-quoted follow-up.
- **Escalates to**: `fleet-account-manager`.

---

## Why this roster

Twelve agents for a single-location business is on the fuller end of the "5-12" range in
`04-ai-agents.md`, justified by real operational surface area a car wash actually has that a
simpler service business wouldn't: a live physical queue needing second-by-second dispatch
(`queue-dispatch-agent`), IoT-monitored equipment where downtime directly costs revenue
(`predictive-maintenance-agent`, `quality-anomaly-detector`), and a subscription billing
lifecycle carrying real churn risk (`membership-billing-agent`). None of these overlap in job:
`wash-concierge` never touches billing logic, `membership-billing-agent` never talks to
customers about wash quality, `queue-dispatch-agent` never messages customers directly (it
hands that to `wash-concierge`). The orchestrator and two advisors are proportionate once the
specialist count passes ~4-5, per `04-ai-agents.md`'s guidance - not padding.
