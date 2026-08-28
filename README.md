# SudsFlow — Car Wash Business Management App

A full-stack, fully responsive web application for managing a car wash business: bookings, customers, vehicles, service catalog, staff, expenses, and revenue reporting.

Built with:

- **Backend:** Node.js, Express, PostgreSQL (Drizzle ORM), JWT authentication
- **Frontend:** React 19 (Vite), React Router, Tailwind CSS v4, Recharts, Axios

## Features

- 🔐 JWT auth with role-based access (`admin`, `manager`, `staff`)
- 📊 Dashboard with live revenue charts, service breakdown, and upcoming bookings
- 📅 Booking management — create, edit, reschedule, assign staff, track status & payment
- 👥 Customer directory with vehicle history, loyalty points, and visit tracking
- 🚗 Vehicle records linked to customers
- 🧴 Service catalog (wash packages, detailing, add-ons) with pricing & duration
- 🧑‍💼 Staff/team management (admin only)
- 💵 Expense tracking by category
- 📈 Reports — revenue trends, booking status breakdown, top services
- 📱 Fully responsive UI — mobile drawer navigation, adaptive tables/cards, touch-friendly forms

## Project structure

```
Carwash-Claude/
├── carwash-compile/ Compiled SplashPoint business-OS spec (see below)
├── server/          Express API (REST, JWT auth, PostgreSQL via Drizzle ORM)
│   └── src/
│       ├── db/            Drizzle table schema + Postgres pool/client
│       ├── controllers/    Route handlers / business logic
│       ├── routes/         Express routers
│       ├── middleware/     Auth guard, error handler
│       └── utils/          Token helper, notify helper, database seed script
├── client/          React (Vite) SPA
│   └── src/
│       ├── pages/         Route-level screens
│       ├── components/    Layout, shared & feature UI components
│       ├── context/       Auth context/provider
│       └── api/           Axios client + resource API modules
└── docker-compose.yml
```

## Getting started (local dev)

### Prerequisites

- Node.js 18+
- A running PostgreSQL instance (local `postgres`, Docker, or a hosted Postgres like Supabase/Neon/RDS)

### 1. Backend

```bash
cd server
cp .env.example .env     # edit DATABASE_URL / JWT_SECRET as needed
npm install
npm run db:push            # syncs the Drizzle schema to your database
npm run seed              # populates demo data + accounts (optional but recommended)
npm run dev                # starts on http://localhost:5000
```

Seeded demo accounts (`npm run seed`):

| Role    | Email                | Password   |
|---------|-----------------------|------------|
| Admin   | admin@carwash.com     | admin123   |
| Manager | manager@carwash.com   | manager123 |
| Staff   | john@carwash.com      | staff123   |

### 2. Frontend

```bash
cd client
cp .env.example .env      # VITE_API_URL, defaults to /api via dev proxy
npm install
npm run dev                # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000` automatically (see `vite.config.js`).

Sign in at `http://localhost:5173/login`, or click a "Quick demo login" button to autofill demo credentials. New workspaces can also self-register — the **first** registered account automatically becomes `admin`.

### 3. Run everything with Docker Compose

```bash
docker compose up --build
```

This starts PostgreSQL, the API (port 5000 — pushing its schema and applying it on every
boot), and the client served via Nginx (port 8080). Run `docker compose exec server npm run
seed` once the stack is up if you want demo data.

## Environment variables

**server/.env**

| Variable          | Description                          |
|-------------------|---------------------------------------|
| `PORT`            | API port (default 5000)               |
| `DATABASE_URL`    | PostgreSQL connection string          |
| `JWT_SECRET`      | Secret used to sign JWTs              |
| `JWT_EXPIRES_IN`  | Token lifetime (e.g. `7d`)            |
| `CLIENT_URL`      | Allowed CORS origin                   |
| `STRIPE_SECRET_KEY` | Optional — enables real membership billing via Stripe Checkout/subscriptions. Omit to run membership signup as a local demo (see below). |
| `STRIPE_WEBHOOK_SECRET` | Optional — required for `/api/webhooks/stripe` to process events (payment success/failure); the endpoint 501s without it even if `STRIPE_SECRET_KEY` is set. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional — enables real WhatsApp Cloud API sends. Omit to log automation decisions to `customer_messages` with `status: not_configured` instead of sending. |
| `ANTHROPIC_API_KEY` | Optional — enables `queue-dispatch-agent`'s real overflow judgment call and `wash-concierge`'s real chat replies. Unlike Stripe/WhatsApp there's no free test mode; costs real tokens once set. Omit for fixed fallback messages. |
| `WHATSAPP_VERIFY_TOKEN` | Optional — required for Meta to register the `/api/webhooks/whatsapp` webhook URL (any string you choose). |
| `WHATSAPP_APP_SECRET` | Optional but recommended — enables `X-Hub-Signature-256` verification on inbound webhook calls. |
| `WHATSAPP_API_VERSION` | Optional, defaults to `v21.0`. |
| `SALES_TAX_RATE` | Optional, defaults to `0.05` — the tax-inclusive rate backed out of `WashOrder.price` when posting to the accounting ledger. Set to the actual local car-wash-service tax rate for a real deployment. |

**client/.env**

| Variable        | Description                                   |
|-----------------|------------------------------------------------|
| `VITE_API_URL`  | Base URL for API calls (default `/api`)        |

## API overview

All endpoints are prefixed with `/api` and (except `/auth/login`, `/auth/register`, `/health`) require an `Authorization: Bearer <token>` header.

| Resource     | Endpoints |
|--------------|-----------|
| Auth         | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users        | `GET/POST /users`, `GET/PUT/DELETE /users/:id` |
| Customers    | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Vehicles     | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id` |
| Services     | `GET/POST /services`, `GET/PUT/DELETE /services/:id` |
| Bookings     | `GET/POST /bookings`, `GET/PUT/DELETE /bookings/:id`, `PATCH /bookings/:id/status`, `PATCH /bookings/:id/payment` |
| Expenses     | `GET/POST /expenses`, `PUT/DELETE /expenses/:id` |
| Dashboard    | `GET /dashboard/summary`, `/revenue-chart`, `/service-breakdown`, `/status-breakdown`, `/upcoming-bookings` |
| Notifications | `GET /notifications`, `/notifications/unread-count`, `PATCH /notifications/:id/read`, `/notifications/read-all` |
| Wash packages | `GET/POST /wash-packages`, `GET/PUT/DELETE /wash-packages/:id` (each carries 3-tier pricing) |
| Service bays | `GET /service-bays`, `POST /service-bays`, `PUT/DELETE /service-bays/:id` |
| Wash orders  | `GET/POST /wash-orders`, `GET /wash-orders/checkout-stats`, `GET /wash-orders/customer-messages`, `GET/DELETE /wash-orders/:id`, `PATCH /wash-orders/:id/{assign-bay,start-wash,complete-wash,qc,checkout,cancel}` |
| Membership plans | `GET/POST /membership-plans`, `GET/PUT/DELETE /membership-plans/:id` |
| Membership subscriptions | `GET/POST /membership-subscriptions`, `PATCH /membership-subscriptions/:id/{pause,resume,mark-paid,cancel}` |
| Inventory | `GET/POST /inventory/supplies`, `PUT/DELETE /inventory/supplies/:id`, `GET/POST /inventory/adjustments`, `GET/POST /inventory/purchase-orders`, `GET /inventory/purchase-orders/:id`, `PATCH /inventory/purchase-orders/:id/{approve,receive,close}`, `GET /inventory/forecast`, `POST /inventory/forecast/run` (admin/manager) |
| Integrations | `GET /integrations/status` — whether Stripe/WhatsApp/AI agents are configured |
| Stripe webhook | `POST /api/webhooks/stripe` (unauthenticated — Stripe's own HMAC signature is the auth, not a bearer token) |
| WhatsApp webhook | `GET /api/webhooks/whatsapp` (Meta's verification handshake), `POST /api/webhooks/whatsapp` (unauthenticated — an optional `X-Hub-Signature-256` check is the auth) |
| Concierge | `GET /concierge/conversations`, `POST /concierge/simulate` (admin/manager — exercises `wash-concierge` without a real WhatsApp number) |
| Tickets | `GET/POST /tickets`, `GET /tickets/:id`, `PATCH /tickets/:id/{status,assign}`, `POST /tickets/:id/comments` |
| Ledger | `GET /ledger/accounts`, `GET /ledger/entries`, `GET /ledger/pnl` (admin/manager) |
| HR | `GET/POST /hr/employees`, `GET/PUT/DELETE /hr/employees/:id`, `GET/POST /hr/shifts`, `PUT/DELETE /hr/shifts/:id`, `PATCH /hr/shifts/:id/{clock-in,clock-out}`, `GET/POST /hr/leave-requests`, `PATCH /hr/leave-requests/:id/decision`, `GET/POST /hr/payroll-runs`, `GET /hr/payroll-runs/:id` (admin/manager) |

## SplashPoint Wash Queue (spec Phases 1, 2, 4, 5, most of 6, CRM/support, finance, HR, inventory)

`carwash-compile/` is a compiled business-OS spec for a fictional 6-bay wash, "SplashPoint
Express Wash" (see `carwash-compile/00-index.md`). Its own deployment guide lays out an
8-step build order; **steps 1–5, four of step 6's agents, the CRM Ticket entity from step
7, a real accounting ledger, HR & payroll, and inventory & purchasing are built and live**
as an additive module alongside the existing booking-based app — (1) the data model +
primary wash lifecycle, (2) role-based UI, (3) RBAC (folded into the Phase 2 work), (4) the
lifecycle's automations, (5) the two integrations the primary lifecycle needs (Stripe,
WhatsApp Cloud API), (6) `queue-dispatch-agent`'s overflow judgment call, `wash-concierge`
(the customer-facing WhatsApp chat agent), `membership-billing-agent` (the past-due/
suspended/cancelled lifecycle), and `inventory-forecaster` (reorder recommendations) — the
latter two make **no Claude call**, see below — (7) a real support-ticket system with SLAs
that gives `wash-concierge`'s escalations somewhere to be tracked to resolution, a real
double-entry accounting ledger (`carwash-compile/05-finance/accounting.md`) that auto-posts
from checkout, membership billing, expenses, payroll, and purchasing, a real staff roster
with scheduling, leave, and a payroll run that posts to that same ledger
(`carwash-compile/03-operations/hr.md`), and a real inventory/purchasing module
(`carwash-compile/03-operations/inventory.md`) that closes the ledger's own previously-dead
`1400`/`2000`/`5700` accounts. All of Stripe,
WhatsApp, and the AI agents are **credential-gated**: this session has none of the
underlying real accounts, so each feature runs in a graceful fallback mode until real keys
are added to `server/.env` — nothing crashes or silently
pretends to work without them. The rest of step 6, the wash-sensor/IoT platform, and the
growth cluster (social/marketing) are still ahead — see "Not built yet" below.

- **Data model**: `WashPackage` (+ 3-tier `PackagePricing`), `ServiceBay`, `WashOrder` — see
  `carwash-compile/01-foundation/data-model.md` for the source spec.
- **Lifecycle**: queue-entry → auto bay assignment (matched to the package's
  tunnel/detail-bay lane) → start wash → complete wash → quality check (pass → ready for
  pickup, fail → looped back to rework) → checkout, plus cancel from Queued/BayAssigned.
  State transitions are enforced server-side (`washOrderController.js`).
- **Role-based views** (`carwash-compile/01-foundation/dashboards.md`), all in the sidebar:
  - **My Queue** (`/floor`, all roles) — the Bay Attendant/Wash Technician home view: next 5
    queued vehicles, next open bay, one-tap log-vehicle/assign-bay/start-wash/complete-wash/
    QC pass-fail. Deliberately minimal, mobile-first.
  - **Checkout** (`/checkout`, all roles) — the Cashier home view: the ready-for-pickup
    queue plus today's revenue split (membership / pay-per-wash / fleet).
  - **Wash Ops** (`/wash-queue`, admin/manager only) — the Site Manager view: the full
    6-bay status board and order table, including completed/cancelled history.
- **RBAC**: `GET /wash-orders` enforces server-side, not just in the UI — a `staff` request
  can never pull completed/cancelled orders (a specific *non-terminal* status like
  `ready-for-pickup` still narrows the result; `admin`/`manager` are unrestricted). Matches
  the spec's Bay Attendant scoping: "'my queue today' only, not the full order history."
- **Automations** (`carwash-compile/03-operations/automations.md`, `server/src/utils/automations.js`)
  — the 3 of 11 spec'd automations scoped to the primary lifecycle (the rest need
  entities/integrations not built yet):
  - `notify-ready-for-pickup` — fires on QC pass, gated by `Customer.whatsappOptIn`; sends a
    real WhatsApp template when configured (see Integrations below), always logged to a
    `customer_messages` audit table (`GET /wash-orders/customer-messages`, admin/manager).
  - `queue-wait-alert` — notifies admin/manager when queue length > 8 or predicted wait
    > 20 min, deduped to at most one alert per 15-minute window.
  - `bay-down-reroute` — when a bay's `operationalStatus` flips to `down`, any order already
    `bay-assigned` there is rerouted to another open bay in the same lane, or requeued if
    none is free; orders already mid-wash/QC on it are escalated to admin/manager instead of
    silently moved, since a wash in progress can't be safely relocated.
- **Integrations** (`carwash-compile/06-platform/integrations.md`) — Stripe (a direct
  secret-key integration; the spec lists oauth2/Stripe Connect, which is for a platform
  onboarding many merchant sub-accounts — this single-location business integrating its own
  account is the correct simplification) and the WhatsApp Business Cloud API:
  - **Membership billing** (`carwash-compile/01-foundation/data-model.md`'s `MembershipPlan`
    + `MembershipSubscription`, the `enroll-membership` workflow) — a "New membership"
    shortcut on the Checkout screen and a `/memberships` admin page (plan CRUD +
    subscription pause/resume/cancel). With `STRIPE_SECRET_KEY` set, sign-up redirects to a
    real hosted Stripe Checkout Session and `POST /api/webhooks/stripe` drives the
    Active↔PastDue/Cancelled state machine from real `invoice.payment_failed`/
    `invoice.payment_succeeded`/`customer.subscription.deleted` events (also firing
    `membership-payment-failed-dunning`). Without it, sign-up creates the subscription
    locally as `active` with no real charge — clearly labeled "demo mode" in the UI.
  - **WhatsApp sends** (`server/src/utils/whatsapp.js`) — `notify-ready-for-pickup` and the
    membership welcome/dunning messages attempt a real template send via the Cloud API when
    `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` are set (still requires the named templates
    to exist and be Meta-approved on that number); otherwise every attempt is logged to
    `customer_messages` with `status: not_configured`.
  - `GET /api/integrations/status` reports live connection state — shown as a banner on
    `/memberships` — so nothing pretends to be connected when it isn't.
- **AI agents** (`carwash-compile/02-intelligence/ai-agents.md`, `server/src/agents/`) —
  the two highest-leverage agents per the deployment guide's own "AI agents, highest-leverage
  first" ordering (`queue-dispatch-agent`, `wash-concierge`), plus `membership-billing-agent`
  once the Ticket/HR/finance phases gave the roster's other entities somewhere to live.
  - `queue-dispatch-agent`'s mechanical job (assign a queued vehicle to the next open bay)
    was already deterministic code since Phase 1 — a well-suited task for a rule, not an
    LLM. What's genuinely judgment-shaped is the spec's own overflow guardrail ("escalates to
    site-manager if predicted wait exceeds 25 minutes... open self-serve overflow or call in
    an extra bay-attendant"). With `ANTHROPIC_API_KEY` set, that specific escalation calls
    Claude for a one- or two-sentence recommendation folded into the `queue-wait-alert`
    notification (tagged `[queue-dispatch-agent]`); without it, the same fixed message this
    app used before agents existed (tagged `[auto]`). The model is never given a tool that
    can mutate `WashOrder`/`ServiceBay` state — guardrail enforced in code, not just the
    prompt — its only output is advisory text a human reads.
  - `wash-concierge` — "the highest-volume customer-facing surface" — is a real inbound
    WhatsApp chat agent (`POST /api/webhooks/whatsapp`, verified via Meta's handshake and an
    optional `X-Hub-Signature-256` check) with a Claude tool-use loop
    (`server/src/agents/washConcierge.js`) covering the spec's conversational flows: wash
    status lookup, membership sign-up (reuses the same Stripe/demo-mode path as the Checkout
    shortcut — `server/src/services/membershipService.js`), pause/cancel, and FAQ. Per-phone
    conversation memory (`agent_conversations`, 90 days) means a repeat question isn't
    answered from scratch. Guardrails enforced in code, not just the prompt: every tool is
    scoped to whichever `Customer` row's phone matches the sender — the model can never
    substitute a different customer/vehicle id — and there is no tool that can change
    pricing, process a cash refund, or set `qcResult`, so those guardrails are structural
    (nothing to call), not just an instruction. A hard round cap forces an escalation instead
    of an unbounded tool-call loop. No key configured -> every inbound message still gets a
    reply and a staff notification (`wash_concierge_escalation`), just not an AI-generated
    one. A `/concierge` admin page shows recent conversations and lets staff exercise the
    agent (`POST /api/concierge/simulate`) without a real WhatsApp number.
  - **Not built** from the spec's own text: detail-bay appointment booking/rescheduling via
    chat — the spec itself says that should be WhatsApp Flows (a structured picker), a
    separate platform feature, not a conversational capability — and a real
    `knowledge_base.search` tool (no KB entity built yet); FAQ content is folded into the
    system prompt instead.
  - `membership-billing-agent` (`server/src/agents/membershipBillingAgent.js`) manages the
    past-due → suspended → cancelled lifecycle on a failed membership charge — but makes
    **no Claude call at all**. The spec's own description of this agent is pure threshold/
    state-machine logic (3 failed attempts or 7 days unresolved → suspend, never cancel
    before that; 30 days unresolved → cancel) with no natural-language judgment call
    anywhere in it — the same automations-vs-agents distinction drawn everywhere else in
    this app (e.g. `queue-dispatch-agent`'s actual bay assignment is deterministic code;
    only its overflow *recommendation* calls Claude). Retrying the charge itself is Stripe's
    own job (Smart Retries); this only reacts to the `invoice.payment_failed`/
    `invoice.payment_succeeded` webhook events already wired in Phase 5, evaluating the
    state machine on each one. A new `PATCH /membership-subscriptions/:id/mark-paid` lets
    staff resolve a past-due/suspended member manually (cash at the counter) — the state
    machine's own "active (paid manually)" exit. **Not built**: a customer-facing WhatsApp
    notice on suspension/cancellation (the spec's own template table doesn't define one for
    either event, only for a payment-failure retry — sending one would mean inventing
    content the spec never specified).
- **CRM & support** (`carwash-compile/04-growth/crm.md`, `server/src/controllers/ticketController.js`)
  — a real `Ticket` entity (damage claims, billing disputes, quality complaints, membership
  questions), state-machined `open → in-progress → waiting-on-customer/resolved → closed`
  (server-enforced, `ticketController.js`'s `ALLOWED_TRANSITIONS`; reopening a resolved/closed
  ticket back to `in-progress` is a practical addition beyond the spec's own table).
  - **SLAs** (`server/src/utils/tickets.js`) — a first-response and resolution deadline per
    category, from the spec's own SLA table, computed live on every read rather than pushed
    proactively (this app has no job scheduler — see the reminder-jobs note below); "at risk"
    means inside the last 25% of the deadline window, not yet breached. Calendar-time
    deadlines, not the spec's business-hours-aware version — a documented simplification.
  - **`wash-concierge` now has somewhere to send an escalation**: `escalate_to_human` creates
    a real Ticket (category derived from the escalation reason — damage claim, refund
    request, negative sentiment, or general) alongside the existing staff notification, so a
    chat escalation is trackable to resolution instead of a fire-and-forget alert.
  - **Customer 360** (`GET /api/customers/:id`, the customer profile modal) — membership
    status and support-ticket history alongside existing wash/booking history, per the
    spec's `customer360Includes`.
  - `/tickets` ("Support" in the sidebar, open to all roles) — filterable list with SLA-risk
    indicators, a detail view with status-transition actions, staff assignment, and a comment
    thread.
  - **Not built** from the spec's own text: the sales pipeline (the spec's own guidance is to
    skip it — no real inbound-lead volume to justify it yet) and a unified omni-channel
    thread linking WhatsApp/email/in-app messages onto one ticket (comments today are
    staff-authored or system-generated only).
- **Finance & accounting** (`carwash-compile/05-finance/accounting.md`, `server/src/services/ledgerService.js`)
  — a real double-entry general ledger: the spec's own 21-account chart, seeded once at
  deploy time, and immutable `JournalEntry`/`JournalLine` rows every one of which traces
  back (`sourceEntity`/`sourceId`) to the `WashOrder`, `MembershipSubscription`, or expense
  that generated it. `postEntry()` refuses to write an unbalanced entry — a bug in a posting
  function fails loudly instead of quietly corrupting the books.
  - **Auto-posting**, per the spec's own "no manual bookkeeping for routine transactions"
    rule — wired into the three workflow steps this app actually has that move money:
    `WashOrder` checkout (cash/card debits `1000 Cash`, `fleet-invoice` debits
    `1100 Accounts Receivable - Fleet` instead — the spec's own account split; a
    membership-paid visit posts nothing new, since that revenue was already recognized when
    the subscription was charged), a successful membership charge (Stripe's
    `invoice.payment_succeeded`, using the invoice's actual `amount_paid` — accurate through
    proration — or the local demo-mode signup simulating one), and this app's pre-existing
    `Expense` entity (not in the spec, but the natural expense side of the same ledger —
    each category maps onto one of the spec's expense accounts). Sales tax is backed out of
    `WashOrder.price` as a tax-inclusive total at a configurable `SALES_TAX_RATE` (default
    5%, matching this app's existing legacy-booking rate) — the spec has no separate tax
    field to read instead.
  - **Never mutates a posted entry** — deleting an expense posts a reversing entry instead
    (the spec's own period-close posture: "lock the period from further edits"). Editing an
    already-posted expense's amount/category does *not* currently re-post a correction — a
    documented simplification, not a silent one.
  - `/finance` (admin/manager) — a date-ranged P&L (revenue/expense by account, net income),
    the full chart of accounts with live balances, and a readable journal.
  - **Not built**, per the spec's own text: payroll posting (needs `03-operations/hr.md`,
    not built) and `PurchaseOrder` receiving (needs an inventory module, not built) — the
    spec's other two auto-posting triggers; refunds (this app's cancel-wash-order flow only
    allows cancelling *before* payment is ever collected, so there's no charge yet to
    reverse); the loyalty-points liability accrual (`2200`/`5600` exist in the chart of
    accounts, but this app has no defined dollar redemption value per point to post against);
    multi-currency (N/A — spec says so too); budgets and budget-vs-actual variance; and the
    weekly Stripe-payout bank reconciliation workflow.
- **HR & staffing** (`carwash-compile/03-operations/hr.md`, `server/src/services/payrollService.js`)
  — a real `Employee` roster, explicitly distinct from the login/RBAC `role` on `users` per
  the spec's own note (`employees.user` links the two but is nullable either way — an
  Applicant with no login yet, or an admin login with no HR record, are both valid).
  - **Scheduling**: `Shift` (employee × time window × optional bay). A shift is flagged
    `isLate` (the spec's `shift-no-show-alert` signal) computed live the same way ticket SLA
    risk is — this app has no scheduler to push it proactively. Clock-in/clock-out are this
    app's own addition (there's no clock-in kiosk hardware to read instead).
  - **Leave**: request → site-manager approval. The spec's own `google-calendar` integration
    that would make `Shift` scheduling "automatically respect" approved leave isn't built —
    instead, creating a `Shift` that overlaps an *approved* leave request is rejected
    directly (409), the same practical effect without a real calendar. The 10-PTO-day/year
    monthly accrual math isn't computed (a request/approve workflow only).
  - **Payroll**: `POST /hr/payroll-runs` sums `Shift` hours (hourly staff) or `annualSalary /
    26` (salaried, `payrollCadence: biweekly`), plus detail-technician commission — read
    directly off `WashOrder.price`/`PackagePricing.price`, the spec's own "commission
    tie-back" so it can never disagree with the P&L's revenue figure — and posts one entry to
    `5000 Payroll Expense` in the ledger built in the previous phase. `washOrderController`
    now records `assignedTechnician` (a column that existed since Phase 1 but nothing ever
    set) when a wash starts, so this has something real to compute against.
  - `/hr` (admin/manager, tabbed: Employees / Shifts / Leave / Payroll).
  - **Not built**, per the spec's own text: real state withholding, Stripe disbursement
    (this only posts the accounting entry — no real money moves), pay-stub document
    generation (needs `06-platform/knowledge-base.md`'s document store), and the quarterly/
    annual performance-review workflow (the spec's own text says not to build this as a
    standing agent at this scale either).
- **Inventory & purchasing** (`carwash-compile/03-operations/inventory.md`,
  `server/src/agents/inventoryForecasterAgent.js`) — Supply (consolidating the spec's own
  separate Supply/Stock entities into one `quantityOnHand` column; single location, no
  batch/lot tracking, `stockTransfers: false` — a documented simplification, not a missing
  feature), `PurchaseOrder` (`Draft → Sent → PartiallyReceived → Received → Closed`), and
  stock write-offs, plus `inventory-forecaster`.
  - `inventory-forecaster` makes **no Claude call** either — same reasoning as
    `membership-billing-agent`: "predicts usage ... flags reorder points" is a rolling
    average and a threshold comparison, not a judgment call. Reads trailing 7-day completed
    `WashOrder` volume *by package*, against a `packageSupplyUsage` table (how much of a
    given Supply one wash of a given Package consumes) — the spec's own "chemical
    consumption scales with package mix, not just wash count." Recommends reordering to a
    30-day par level whenever on-hand drops below a 7-day supply; POs under $150
    auto-approve and send, above it stay `Draft` for a manual approval. Its own trigger
    ("nightly schedule") isn't built — this app has no scheduler, so a site-manager runs it
    on demand from `/inventory`'s Forecast tab instead. **Known simplification**:
    recommendations don't subtract quantity already on an open PO for the same supply, so
    running it twice before a shipment arrives double-recommends (and, on "Run forecast
    now," double-orders) — a sharper edge on the on-demand substitute than the spec's own
    once-nightly cadence would ever hit.
  - **Receiving a shipment** posts the A/P entry (`1400 Chemical & Supply Inventory` /
    `2000 Supplier Payables`) and **closing** a fully-received PO posts the cash settlement
    (`2000` / `1000 Cash`) — the first real activity on either of those two accounts, seeded
    but dead since the finance phase. A **stock write-off** (`breakage`/`spillage`/`theft`/
    `expired`/`count-correction`, always requiring an `Employee` approver) posts to
    `5700 Inventory Shrinkage Expense` the same way.
  - `/inventory` (admin/manager, tabbed: Supplies / Purchase Orders / Adjustments /
    Forecast).
  - **Not built**: multi-warehouse stock transfers (the spec's own `stockTransfers: false`
    says skip it), and a `fleet-account-manager` bonus tie-in (`Customer.isFleetAccount`
    doesn't exist in this app's `Customer` model).
- **Not built yet** (later phases per the spec's own build order): the rest of the AI agent
  roster (`predictive-maintenance-agent` and `quality-anomaly-detector` — need IoT telemetry
  this app has no sensors for; `review-response-agent`, `phone-line-agent`,
  `fleet-lead-scorer` — need channels/entities this app doesn't have; `ops-orchestrator` and
  the two advisor agents — proportionate once the specialist roster is fuller, per the
  spec's own guidance, not yet at this stage); the wash-sensor/IoT platform; the -3d/-2h
  reminder jobs and proactive SLA-breach alerting (need a scheduler this app doesn't run
  yet); and social/marketing —
  and RBAC only covers this app's existing admin/manager/staff login roles, not the spec's
  full 7-role breakdown (Owner/Site Manager/Bay Attendant/Wash Technician/Detail
  Technician/Cashier/Fleet Account Manager) — the new `Employee.position` field captures the
  job title, but doesn't yet drive what a person can actually do in the system.

## Responsiveness

Every screen adapts across breakpoints:

- Sidebar navigation collapses into a slide-over drawer with a hamburger toggle on mobile/tablet.
- Data tables scroll horizontally on narrow viewports instead of breaking layout.
- Stat cards, forms, and charts reflow from 1 → 2 → 4 column grids using Tailwind's responsive utilities.
- Modals dock to the bottom of the screen on mobile and center on desktop.
