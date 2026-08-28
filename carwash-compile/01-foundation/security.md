# Security: RBAC / ABAC

*Part of the Foundation cluster. Compiled from `bir.json`.*

Nineteen principals carry permissions here - 7 human roles and 12 AI agents, the latter
scoped strictly to what their `aiAgents` definition in `02-intelligence/ai-agents.md` says
they touch. Full `security.permissions` table lives in `bir.json`; this file explains the
shape and the policies a table alone can't express.

---

## RBAC summary

| Role | Scope pattern |
|---|---|
| `owner` | Full read/write/approve on every entity, logged the same as anyone else's actions |
| `site-manager` | Full read within the site, update + approve on operational entities (WashOrder, MaintenanceOrder, PurchaseOrder, Invoice, Payment); create/read/update on Employee/Shift; no delete on financial/staff records |
| `bay-attendant` / `wash-technician` / `detail-technician` | Create/read/update on WashOrder and their assigned ServiceBay only; no financial or HR access |
| `cashier` | Create/read/update on WashOrder, Customer, Vehicle, MembershipSubscription, Payment, Invoice - the checkout surface only |
| `fleet-account-manager` | Read/update on Customer and Invoice, read-only on WashOrder - scoped to the fleet segment |
| AI agents | Strictly `entitiesTouched` from their agent definition, and only the actions their guardrails allow autonomously - anything above a guardrail threshold is `approve`-gated to `site-manager`, not silently permitted (e.g. `inventory-forecaster` can `create` a `PurchaseOrder` but never `approve` one above $150) |

Full role x entity x action rows are in `bir.json -> security.permissions` (37 rows) - every
role/agent that appears as a workflow actor, an agent `entitiesTouched`, a KPI `targetRole`,
or an API scope has at least one matching row, closing the "orphaned role" gap
`22-qa-and-completeness.md` checks for.

---

## ABAC policies

- A `site-manager` can only approve a refund or PO within their own site's scope - moot at
  single-location scale today, stated now so it doesn't need re-deriving if a second location
  is added later.
- A support agent (human or `wash-concierge`) can view `Customer.paymentMethodToken` only in
  masked/last-4 form, and only while handling an active `WashOrder` or `Ticket` for that
  customer - never for general browsing.
- Marketing campaigns, drip sequences, and WhatsApp MARKETING-category templates
  (`04-growth/marketing.md`, `04-growth/whatsapp.md`) can only target customers where
  `Customer.marketingConsent == true` - enforced here at the security layer, not left as a
  marketing-team convention.
- Only `site-manager` or `owner` can approve a `MaintenanceOrder` that takes a bay offline
  during posted operating hours, unless the triggering `Asset` is already `status = down` or
  unsafe to keep running - in which case `predictive-maintenance-agent` acts immediately and
  notifies `site-manager` after the fact rather than blocking on approval.

---

## Sensitive data handling

Fields marked `piiOrSensitive: true`: `Customer.phone`, `Customer.email`,
`Customer.paymentMethodToken`, `Vehicle.licensePlate`, `Employee.hourlyRate`,
`Employee.emergencyContact`, `Payment.processorTxnId`.

- Encrypted at rest and in transit - required, not optional.
- `Employee.hourlyRate` and `emergencyContact` are visible only to `site-manager`/`owner` - a
  co-worker never sees another employee's pay rate, per `19-hr-payroll.md`'s note.
- `Vehicle.licensePlate` is restricted to the roles that need it operationally
  (bay-attendant, wash-technician, cashier for plate-to-membership lookup) and never exposed
  externally beyond the `platformApi` scopes defined in `06-platform/api-webhooks.md`.
- `Customer.paymentMethodToken` and `Payment.processorTxnId` are Stripe tokens, never raw
  card data (see PCI note below) - front-of-house sees last-4 only.
- Every access to a sensitive field is logged, not just every write.

## Audit

Every create/update/delete on `WashOrder`, `Invoice`, `Payment`, `MembershipSubscription`,
`JournalEntry`, and `Employee` writes to an append-only audit log: actor (role or agent id),
timestamp, before/after diff. Agent actions are logged identically to human ones - this is
what makes "the predictive-maintenance agent took the tunnel offline at 2:14pm" reviewable
after the fact, not just asserted.

## Compliance notes

- **PCI-DSS scope minimization**: card data is never stored directly -
  `Customer.paymentMethodToken` and `Payment.processorTxnId` are Stripe-issued tokens, per
  `06-platform/integrations.md`'s payments integration.
- **Wastewater/environmental permitting**: the `water-reclaim-ro-system` Asset's turbidity and
  discharge readings (`03-operations/assets-iot.md`) are retained in its maintenance log for
  inspection readiness - most jurisdictions license car washes on reclaim-system performance.
- **Employee data**: compensation and any government-ID field collected at hire are
  `piiOrSensitive` and restricted per the RBAC table above.
- No health, food-safety, or childcare-specific regime applies to this business category.
- No EU/CA-specific data-subject-rights note is added by default (single US-state operation
  per `meta.assumptions`) - revisit if the business later serves CA residents or expands
  internationally.
