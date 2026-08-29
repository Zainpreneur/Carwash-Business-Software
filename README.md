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
| Simulations | `GET /simulations/{bay-throughput,demand-forecast,staffing-capacity,membership-economics,cash-flow-forecast}`, `POST /simulations/pricing-scenario` (admin/manager) |
| Agent ops | `GET /agent-ops/orchestrator-snapshot`, `POST /agent-ops/strategy-advisor/ask`, `GET /agent-ops/strategy-advisor/history`, `GET /agent-ops/system-health-report` (admin/manager) |
| Growth | `GET /growth/segments/{summary,customers}`, `GET/POST /growth/fleet-inquiries`, `PATCH /growth/fleet-inquiries/:id/status`, `GET/POST /growth/reviews` (admin/manager) |
| Knowledge Base | `GET /knowledge-base`, `GET /knowledge-base/:id` (any authenticated role), `POST /knowledge-base`, `PATCH/DELETE /knowledge-base/:id` (admin/manager) |
| Documents | `GET /documents/wash-receipt/:orderId`, `GET /documents/membership-agreement/:subscriptionId`, `GET /documents/wash-package-comparison` (any authenticated role) |
| Analytics | `GET /analytics/health-score` (admin/manager), `PATCH /analytics/health-score/weights` (admin only), `GET /analytics/reports/{revenue-by-bay-daily,membership-mix-weekly,package-tier-margin,aov-by-vehicle-type,technician-throughput,ar-aging}` (admin/manager) |
| Audit log | `GET /audit-log` (admin/manager) — filter with `?entity=`, one of `wash_order`\|`membership_subscription`\|`journal_entry`\|`employee` |
| Integrations | `GET /integrations/status` — whether Stripe/WhatsApp/AI agents are configured |
| Stripe webhook | `POST /api/webhooks/stripe` (unauthenticated — Stripe's own HMAC signature is the auth, not a bearer token) |
| WhatsApp webhook | `GET /api/webhooks/whatsapp` (Meta's verification handshake), `POST /api/webhooks/whatsapp` (unauthenticated — an optional `X-Hub-Signature-256` check is the auth) |
| Concierge | `GET /concierge/conversations`, `POST /concierge/simulate` (admin/manager — exercises `wash-concierge` without a real WhatsApp number) |
| Tickets | `GET/POST /tickets`, `GET /tickets/:id`, `PATCH /tickets/:id/{status,assign}`, `POST /tickets/:id/comments` |
| Ledger | `GET /ledger/accounts`, `GET /ledger/entries`, `GET /ledger/pnl` (admin/manager) |
| HR | `GET/POST /hr/employees`, `GET/PUT/DELETE /hr/employees/:id`, `GET/POST /hr/shifts`, `PUT/DELETE /hr/shifts/:id`, `PATCH /hr/shifts/:id/{clock-in,clock-out}`, `GET/POST /hr/leave-requests`, `PATCH /hr/leave-requests/:id/decision`, `GET/POST /hr/payroll-runs`, `GET /hr/payroll-runs/:id` (admin/manager) |

## SplashPoint Wash Queue (spec Phases 1, 2, 4, 5, most of 6, CRM/support, finance, HR, inventory, simulation, agent ops, growth, knowledge base, analytics, audit log)

`carwash-compile/` is a compiled business-OS spec for a fictional 6-bay wash, "SplashPoint
Express Wash" (see `carwash-compile/00-index.md`). Its own deployment guide lays out an
8-step build order; **all 8 steps have something real and live**, though step 6 (the AI
agent roster) is still missing the three agents that genuinely need IoT telemetry or a
telephony API — (1) the data model +
primary wash lifecycle, (2) role-based UI, (3) RBAC (folded into the Phase 2 work), (4) the
lifecycle's automations, (5) the two integrations the primary lifecycle needs (Stripe,
WhatsApp Cloud API), (6) nine of the 12-agent roster — `queue-dispatch-agent`'s overflow
judgment call, `wash-concierge` (the customer-facing WhatsApp chat agent),
`membership-billing-agent` (the past-due/suspended/cancelled lifecycle),
`inventory-forecaster` (reorder recommendations), `ops-orchestrator` (the day's operating
picture), `strategy-advisor` plus `system-health-agent` (open-ended owner Q&A and a
weekly agent-health report), and `fleet-lead-scorer` plus `review-response-agent` (the
growth cluster's two task agents) — five of the nine make **no Claude call at all**, see
below — (7) a real support-ticket system with SLAs
that gives `wash-concierge`'s escalations somewhere to be tracked to resolution, real
customer segmentation and a referral program (`carwash-compile/04-growth/marketing.md`), a
real authored Knowledge Base that grounds `wash-concierge`'s FAQ answers instead of a static
system prompt, plus real generated wash-receipt/membership-agreement/wash-package-comparison
documents rendered from live records (`carwash-compile/06-platform/knowledge-base.md`), a
real business health score computed from the spec's own KPI formulas with owner-editable
weights, five of the reporting cube's six named reports, and a real AR Aging report backed
by a genuine fleet-invoice collection workflow that didn't exist before this phase
(`carwash-compile/02-intelligence/analytics.md`), a real append-only audit log covering
WashOrder/MembershipSubscription/JournalEntry/Employee with genuine human- and
agent-attributed actors (`carwash-compile/01-foundation/security.md`), a
real double-entry accounting ledger (`carwash-compile/05-finance/accounting.md`) that
auto-posts from checkout, membership billing, expenses, payroll, and purchasing, a real
staff roster with scheduling, leave, and a payroll run that posts to that same ledger
(`carwash-compile/03-operations/hr.md`), and a real inventory/purchasing module
(`carwash-compile/03-operations/inventory.md`) that closes the ledger's own previously-dead
`1400`/`2000`/`5700` accounts, and (8) five of `02-intelligence/simulation.md`'s seven
forecasting models (`carwash-compile/02-intelligence/simulation.md`) — bay-throughput,
demand, staffing-capacity, membership-economics, and cash-flow — computed live from real
data with every stated assumption labeled, per the spec's own "ship it with clearly-labeled
industry-benchmark defaults from day one" guidance for this exact step. All of Stripe,
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
  - FAQ answers are grounded against real, authored Knowledge Base articles via a
    `search_knowledge_base` tool — the spec's own `knowledge_base.search` — rather than
    folded into the system prompt as static text; see the **Knowledge Base** section below.
  - **Not built** from the spec's own text: detail-bay appointment booking/rescheduling via
    chat — the spec itself says that should be WhatsApp Flows (a structured picker), a
    separate platform feature, not a conversational capability.
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
- **Simulation & forecasting** (`carwash-compile/02-intelligence/simulation.md`,
  `server/src/services/simulationService.js`) — build-order step 8, the last one. Five of
  the spec's seven models, all **pure, stateless computations over data this app already
  has** — nothing is persisted, the same "compute live, don't push" posture as ticket SLA
  risk and shift no-show flags. Every stated assumption (variable-cost components, service
  rates, price elasticity) is a named, editable constant in one place, and every number in
  every API response carries a `dataSource: 'observed' | 'industry-benchmark'` label — the
  spec's own "Calibration and honesty" rule that a founder "needs to know how much to trust
  the number."
  - **bay-throughput-queue-simulator** and **membership-economics-simulator** — the spec's
    own "two that matter most... get the deepest treatment" — are both fully built.
    Bay-throughput reads real `ServiceBay.avgThroughputPerHour` and recent `WashOrder` queue
    volume by lane to flag a structurally-undersized bay/hour combination. Membership
    economics computes a real variable-cost-per-wash from actual `Employee` wage data (not
    just the spec's own worked-example constants) and each plan's real
    `washesThisCycle`/cancellation history once there's enough of it, falling back to the
    spec's own industry-benchmark distribution (median 3.2 washes/month, ~14-month tenure)
    until then — exactly the "ship with labeled defaults from day one" the spec calls for.
  - **demand-forecast**: a real day-of-week/hour-of-day curve from `WashOrder` history once
    ~8 weeks exist; an industry-benchmark-shaped curve, clearly labeled, before that (this
    session's own seed data is all "today," so it always shows the benchmark path — a good
    live demonstration of the fallback, not a bug). **Not built**: the spec's own
    `weather-api` rain/pollen overlay (no weather integration exists).
  - **staffing-capacity-simulator** ties the demand forecast against real `Shift` coverage
    (from the HR phase) to flag understaffed hour/day combinations, at stated
    vehicles-per-hour service-rate assumptions per role.
  - **cash-flow-forecast** projects a weekly grid from real membership MRR, demand-derived
    pay-per-wash revenue, and real trailing payroll/purchase-order/expense outflow (from the
    finance, HR, and inventory phases) — flags any week the running balance would go
    negative.
  - **pricing-scenario-simulator** is interactive on `/simulations`: pick a plan, a price
    change %, and an elasticity assumption (default -0.3, the spec's own "10% price increase
    costs ~3% of the member base"), see the projected member-count/revenue/margin delta
    live.
  - **Not built**: **downtime-cost-simulator** — its own inputs (`Asset.status = 'down'`
    windows) come from `03-operations/assets-iot.md`, which needs an Asset/IoT entity this
    app doesn't have, so there's nothing to compute it from yet.
- **Orchestrator & advisor agents** (`02-intelligence/ai-agents.md`'s "Orchestrator" and
  "Advisor agents" sections, `server/src/agents/{opsOrchestrator,strategyAdvisor,systemHealthAgent}.js`)
  — the last two clusters of the 12-agent roster this app implements against real entities,
  built once the four specialist agents below existed for them to sit above.
  - **`ops-orchestrator`** makes **no Claude call** — its own guardrail ("routing only, no
    independent transactional authority") describes deterministic aggregation, not a
    judgment call, the same reasoning that kept `membership-billing-agent` and
    `inventory-forecaster` LLM-free. It aggregates real queue depth, bay status, the current
    hour's staffing gap (from the simulation phase), unread escalation-type notifications,
    and open tickets into one "operating picture," and deterministically names which
    specialist/automation already owns each flagged condition — real routing logic, not a
    narrated summary.
  - **`strategy-advisor`** is genuinely open-ended — "answers open-ended owner questions...
    with a structured, traceable recommendation" — so it does call Claude, grounded in a
    single injected snapshot of real bay-throughput/membership-economics/cash-flow/staffing
    data rather than a `wash-concierge`-style tool-use loop (an owner's question doesn't need
    the model poking at live tables turn by turn). No tools at all — the guardrail "never
    commits to a lease, hire, price change" is structural, not just an instruction. A new
    `strategy_recommendations` table *is* the spec's own "remembers prior recommendations...
    12 months" requirement: a real row per question, with a cheap word-overlap check
    surfacing (and asking Claude to explicitly reference, not silently contradict) a related
    earlier question. No key configured → a plain fallback message pointing at the
    Finance/Simulations/Reports pages directly, not a blocked request.
  - **`system-health-agent`** also calls Claude (root-cause-5-whys: is a rate "off," and if
    so, why — a real judgment call) to narrate a weekly report over a new `agent_metrics`
    table — nothing logged agent invocations before this phase, so every credential-gated
    agent (`queue-dispatch-agent`, `wash-concierge`, `membership-billing-agent`,
    `inventory-forecaster`, `strategy-advisor`) now records one row per call
    (`server/src/utils/agentMetrics.js`, fire-and-forget). Its own system prompt explicitly
    refuses the spec's named anti-pattern — "never propose lowering an escalation-confidence
    threshold as the fix for a high escalation rate." No key configured → the raw computed
    per-agent rates without a narrative, still a real report, just not written up.
  - Both agents' real triggers ("every 5 minutes," "weekly, Monday 6am") need a scheduler
    this app doesn't have (the same documented gap as the -3d/-2h reminder jobs and
    proactive SLA alerts) — a site-manager runs both on demand from the new `/ops-center`
    page instead.
- **Growth cluster** (`carwash-compile/04-growth/marketing.md`, `04-growth/social-media.md`)
  — the two remaining task agents this app can build against real (if manually-entered)
  data rather than a live ad-platform or Google Business Profile connector it has no
  credentials for, plus the spec's own customer segmentation and referral program.
  - **Customer segmentation** (`server/src/services/segmentService.js`) — the marketing
    spec's own 7-segment table (New / Active Pay-Per-Wash / Active Member / At-Risk Member /
    At-Risk Pay-Per-Wash / Lapsed / Fleet-Commercial), computed live from real `WashOrder`/
    `MembershipSubscription` data, with an explicit precedence order for a customer whose
    segments would otherwise overlap (e.g. a fleet account is always Fleet/Commercial first).
    The spec's own "2+ missed expected visits this cycle" clause for At-Risk Member isn't
    computed — this app has no per-member expected-visit-cadence baseline to miss against —
    so only the "recent PastDue" half of that definition is checked.
  - **`fleet-lead-scorer`** makes **no Claude call** — scoring three stated inputs (vehicle
    count, contact pattern, invoicing-terms request) against stated point values is
    arithmetic, not a judgment call. New `Customer.isFleetAccount` field and `fleet_inquiries`
    table; never commits to custom pricing itself, only ever a staff notification.
  - **`review-response-agent`** also makes **no Claude call**, deliberately: the guardrail
    ("never auto-responds to a review below 4 stars or one mentioning damage/injury/billing")
    is a rating threshold plus a keyword check, not free-form sentiment judgment — a
    coarser check than an LLM's read, but one that never has a false "auto-responded" on a
    review that should have been escalated, the conservative failure mode the spec's own
    reputational-risk framing asks for. A positive review with no flagged keywords
    auto-thanks with a loyalty-point credit; anything else opens a real `Ticket` and alerts
    staff immediately, never auto-responded.
  - **Referral program**: every customer gets a stable `referralCode` at creation;
    `referredByCode` is checked once, on a referred customer's first-ever completed
    `WashOrder`, crediting the referrer a free-wash credit (modeled as loyalty points, since
    there's no redeemable-credit ledger or checkout-time "apply a free wash" flow to redeem
    a real credit against). **New-customer-welcome** fires its day-0 rung (thank-you +
    loyalty-points explainer) on that same first wash.
  - `/growth` (admin/manager, tabbed: Segments / Fleet Inquiries / Reviews).
  - **Not built**: the day-3/day-10 (new-customer-welcome) and day-4/day-8 (at-risk-member-
    winback, whose day-0 the finance phase's own payment-failed dunning already covers)
    follow-up rungs of each lifecycle drip (need a scheduler this app doesn't have); the
    `SocialPost` content-calendar publishing pipeline; paid ad campaigns and A/B testing
    (need real ad-platform accounts); and the Google Business Profile/social-mention
    monitoring that would detect a review automatically instead of a staff member logging it.
- **Knowledge Base** (`carwash-compile/06-platform/knowledge-base.md`,
  `server/src/db/schema.js`'s `knowledgeArticles` table, `server/src/controllers/knowledgeBaseController.js`)
  — closes a gap `wash-concierge`'s own file header had flagged since Phase 6: the spec names
  a real `knowledge_base.search` tool, and says `wash-concierge`/`review-response-agent`/
  `phone-line-agent` must cite a KB article rather than freely inventing a policy answer.
  - Authored articles in three categories: `knowledge-article` (FAQ, searchable by
    `wash-concierge`), `customer-facing` (policy documents, also searchable), and `internal`
    (SOPs/safety procedures, staff-only — never reachable from the customer-facing search
    tool, verified by querying it with internal-only terminology and confirming no match).
  - Edits version instead of overwrite: every save bumps `version` and pushes the prior
    title/body onto `previousVersions` rather than discarding it — the spec calls this out by
    name for `chemical-handling-sds-log` ("what did the SDS say on a given date") and
    `membership-agreement`, and the other article types get the same history for free. A
    version-history view is on `/knowledge-base`.
  - `wash-concierge`'s new `search_knowledge_base` tool does simple keyword-overlap scoring
    over the searchable categories and returns the top 3 matches (or `found: false`) — no
    vector search or embeddings, appropriate for a single-location shop's "a handful of
    documents" scale per the spec's own framing. The system prompt requires citing what an
    article actually says and escalating instead of answering from memory when nothing
    relevant comes back.
  - `/knowledge-base` (all roles can read — bay-safety-procedure and the SDS log are for
    floor staff, not just admin/manager; only admin/manager can author/edit/delete, same
    write gate as Services/Wash Packages).
  - **Not built**: the spec's `google-business-profile` (public policy sync) and
    `generic-custom-webhook`-backed internal wiki sources — articles are authored directly
    through this page instead of synced from an external system. `review-response-agent`
    doesn't consult the KB (it makes no Claude call — nothing to ground), and
    `phone-line-agent` isn't built (needs a real telephony API) so it can't either; only
    `wash-concierge` is wired to search it.
- **Generated documents** (`carwash-compile/06-platform/knowledge-base.md`'s three
  "generated from" document types, `server/src/services/documentService.js`) — deterministic
  template + variable renders against live records, "same pattern as the WhatsApp templates"
  per the spec's own text, as opposed to the authored articles above.
  - **`wash-receipt`** — customer, vehicle, package, payment method, and a subtotal/tax/total
    breakdown that reads the same `TAX_RATE` constant the accounting ledger posted that
    checkout with, so a receipt can never disagree with the books. Only generates for an
    order that's actually been checked out — a receipt for an in-progress wash would be
    printing a sale that hasn't happened yet. A receipt icon appears on any `completed` row
    in `/wash-queue`.
  - **`membership-agreement`** — member, vehicle, plan terms (unlimited/capped, rollover,
    monthly price, billing day) plus the standard pause/cancel/past-due-suspend-cancel policy
    text, from a "View agreement" icon on each row in `/memberships`. Documented gap: this
    app doesn't snapshot plan terms onto a subscription at signup
    (`membershipSubscriptions.plan` is a live foreign key, not a point-in-time copy), so
    re-generating this later shows the plan's *current* terms — if the plan's price changed
    after a member signed up, this won't show what they actually agreed to on their signup
    date, which is the spec's own stated reason for wanting version history on this document
    type in the first place.
  - **`wash-package-comparison`** — every active package's tiers and per-vehicle-type
    pricing, from a "Package comparison" button on `/memberships` — the same data
    `wash-concierge`'s `list_wash_packages` tool reads, rendered as something a cashier can
    hand a customer instead of narrating pricing verbally.
  - No PDF file is generated or stored — each document is a structured render the browser's
    own print dialog turns into a PDF (`window.print()`, scoped via a print stylesheet so it
    doesn't dump the whole dashboard onto paper), which is the deterministic template +
    variable substitution behavior the spec actually asks for, without adding a PDF-rendering
    dependency for three simple templates.
  - **Not built**: e-signature on `membership-agreement` at signup (the spec's own stated
    requirement for that one document type) — signup here is a click, not a signed record.
- **Business health score** (`carwash-compile/02-intelligence/analytics.md`'s "Executive View"
  composite, `server/src/services/healthScoreService.js`) — the one piece of the spec's much
  larger reporting-cube/analytics chapter this app builds against real data; the rest is
  listed under "Not built yet" below.
  - Five components, weighted exactly per the spec's own `bir.json` KPI formulas:
    membership-penetration-rate (`count(WashOrder where paymentMethod=membership) /
    count(WashOrder)`, trailing 30 days), bay-utilization-rate (`sum(washCompletedAt -
    washStartedAt) / (operational hours x bay count)`), net-membership-growth (new minus
    cancelled subscriptions this calendar month), avg-review-rating (from the real `reviews`
    table the growth cluster built), and equipment-uptime-rate.
  - **equipment-uptime-rate is a documented proxy**, not the spec's real figure: the formula
    wants `Asset` downtime-hours from `03-operations/assets-iot.md`, which this app doesn't
    have (no IoT/Asset entity at all). This computes "share of `ServiceBay`s not currently
    down" instead — a live snapshot, not a trailing-30-day downtime ratio — and labels itself
    as a proxy everywhere it's shown.
  - **Normalization is this app's own interpretive choice**, called out because the spec
    doesn't specify one: the five KPIs land on different scales (a 0-1 rate, a raw
    subscriber-count delta, a 1-5 star average) that can't be weighted-summed as-is, so each
    is mapped to a 0-100 score first. A component with no underlying data yet (e.g. zero
    reviews logged) is excluded and its weight redistributed across the rest, rather than
    scored as a 0 — scoring "no reviews yet" the same as "1-star reviews" would be actively
    misleading.
  - Weights are stored in a real `health_score_weights` settings row, not a hardcoded
    constant — "weighting is intentionally visible and editable by owner" per the spec, and
    an admin (this app's closest equivalent to "owner") can rebalance them from `/reports`,
    validated server-side to still sum to 1.0.
  - Shown at the top of `/reports` (admin/manager) with a per-component breakdown and an
    "Edit weights" action for admin.
- **Reporting cube** (`02-intelligence/analytics.md`'s six named reports,
  `server/src/services/reportingCubeService.js`) — five of the six, computed from real data
  already in this app's tables, shown as a report-picker table on `/reports`.
  - `revenue-by-bay-daily`, `membership-mix-weekly`, `aov-by-vehicle-type` — straightforward
    groupings of real `WashOrder` history by bay/day, payment method/week, and vehicle
    type, respectively. Revenue is always price net of its embedded sales tax (the same
    convention the ledger and business health score already use), never raw `price`.
  - `package-tier-margin` — `ChemicalCostPerWash` reuses the real per-wash chemical
    consumption model `inventory-forecaster` already built
    (`packageSupplyUsage x Supply.unitCost`) rather than re-deriving it; `GrossMargin`
    subtracts that from each tier's trailing-30-day average revenue per wash.
  - `technician-throughput` — bir.json pairs this report with a `BayUtilization` measure,
    which doesn't really describe a person; this app substitutes washes-handled-per-hour
    from real `Shift` clock-in/out data, documented as its own interpretation of a
    measure/dimension pairing that doesn't fit a technician literally.
  - **Not built**: `equipment-uptime-by-asset` — needs a real `Asset` entity with a
    downtime-hours log (`03-operations/assets-iot.md`), the same gap the health score's
    equipment-uptime proxy already documents, with no per-Asset breakdown to add on top of a
    proxy that has no per-Asset granularity to begin with.
- **AR Aging** (`02-intelligence/analytics.md`'s financial-statements table) — fleet invoices
  only, per the spec's own text ("pay-per-wash and membership are collected at time of
  service"). Building this exposed a real gap: nothing in this app previously modeled a fleet
  invoice's payment actually arriving — checkout only ever posted the Accounts Receivable
  debit, with no matching cash-in entry, so every fleet invoice would have sat in
  "outstanding" forever with no way to age out. Fixed with a new
  `WashOrder.fleetInvoiceCollectedAt` field and a `PATCH
  /wash-orders/:id/collect-fleet-invoice` action (admin/manager) that posts the missing
  ledger entry (`ledgerService.postFleetInvoiceCollection`). `/reports`' AR Aging card buckets
  every uncollected fleet invoice by age (current/15-30/30-45/45+) with a "Mark collected"
  action per invoice.
- **Audit log** (`carwash-compile/01-foundation/security.md`'s "Audit" section,
  `server/src/utils/auditLog.js`) — "every create/update/delete on WashOrder, Invoice,
  Payment, MembershipSubscription, JournalEntry, and Employee writes to an append-only audit
  log: actor, timestamp, before/after diff. Agent actions are logged identically to human
  ones." This app has no separate Invoice/Payment entities (fleet billing and membership
  charges post straight to the ledger — see `ledgerService`'s own header comment), so this
  covers the four that actually exist.
  - `JournalEntry` logs from a single choke point — `ledgerService.postEntry`, the only way a
    journal entry is ever created — rather than being repeated at every posting function's
    call site.
  - Real agent-actor entries, not a placeholder: `wash-concierge`'s `start_membership_signup`
    and `manage_membership` tools (both already built, in earlier phases) now log with
    `actorType: 'agent', actorId: 'wash-concierge'` when they create, pause, or cancel a
    subscription over WhatsApp — the spec's own "agent actions logged identically to human
    ones" requirement, demonstrated with a real existing agent rather than a synthetic
    example. Stripe-webhook-driven transitions (`membership-billing-agent`'s automatic
    suspend/cancel state machine, and the checkout-completed subscription creation) log with
    `actorType: 'agent'`/`'system'` respectively — the actor field genuinely reflects who or
    what triggered each row, not a single hardcoded value.
  - Diffing `before`/`after` required care: the first version of this compared a raw DB row
    (`before`) against the joined/formatted shape the API returns (`after`, with
    bay/package/vehicle as nested objects) and showed every relation as "changed" even when
    it wasn't. Fixed by fetching a second raw row for the audit snapshot, kept separate from
    the joined response the client actually renders.
  - `/audit-log` (admin/manager) — filterable by entity, each row opens a diff view showing
    only the fields that actually changed (skipping `createdAt`/`updatedAt` noise), not a raw
    JSON dump of the whole row.
  - **Not built**: `inventoryService`'s purchase-order/stock-adjustment ledger postings and
    `payrollService`'s payroll-run posting don't pass a real actor through yet — those
    `JournalEntry` rows log with `actorType: 'system'` rather than the staff member who
    triggered them, a documented gap rather than a silent one.
- **Not built yet**: full financial statements beyond what AR Aging plus the existing
  Finance/Ledger pages now cover (a P&L segmented by the cube's own dimensions, Cash Flow
  detail), cohort & retention analysis, WoW/MoM/YoY benchmarking, the anomaly-detection rule
  table, and the scheduled owner/site-manager digests (`02-intelligence/analytics.md`) — all
  of which lean heavily on the scheduler this app doesn't have (see the reminder-jobs gap
  below) for their "daily"/"weekly" cadences; the rest of the AI agent roster
  (`predictive-maintenance-agent` and
  `quality-anomaly-detector` — need IoT telemetry this app has no sensors for; `phone-line-agent`
  — needs a real telephony API); the wash-sensor/IoT platform; the -3d/-2h reminder jobs and
  proactive SLA-breach alerting (need a scheduler this app doesn't run yet) —
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
