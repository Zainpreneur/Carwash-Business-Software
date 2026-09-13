# SudsFlow — Car Wash Business Management App

A full-stack, fully responsive web application for managing a car wash business: bookings, customers, vehicles, service catalog, wash-floor operations, memberships, support tickets, staff scheduling, inventory & purchasing, expenses, and revenue reporting. **One command runs the whole thing on one port.**

Built with:

- **Backend:** Node.js, Express, SQLite (libSQL / Drizzle ORM), JWT authentication
- **Frontend:** React 19 (Vite), React Router, Tailwind CSS v4, Recharts, Axios
- **Database:** a single local file (`server/local.db`) — no external database server to install or run. Optional real Stripe/WhatsApp credentials enable live integrations; without them everything runs in demo/fallback mode.

## Quick start

### One command (recommended)

```bash
npm.cmd run start
```

That `setup` → `build` → `serve` chain (see `package.json`) will:

1. Install `server/` and `client/` dependencies (only if missing),
2. Create `server/.env` from `.env.example` the first time,
3. Create `server/local.db`, push the schema, and seed demo data (only if the file doesn't already exist),
4. Build the React app into `server/static/`,
5. Start **one** Express server on **one port**: http://localhost:5000

The API (`/api/...`) and the UI are served by that single process — the built SPA also uses `index.html` as the fallback for client-side routes (any non-`/api` path).

On Windows you can also just double-click `start-cw.cmd`.

### Manual steps

```bash
npm.cmd run setup     # deps + .env + database (schema + seed) if needed
npm.cmd run build     # client -> server/static (Vite)
npm.cmd run serve     # starts the Express server on :5000
```

Seeded demo accounts:

| Role    | Email                | Password   |
|---------|----------------------|------------|
| Admin   | admin@carwash.com     | admin123   |
| Manager | manager@carwash.com   | manager123 |
| Staff   | john@carwash.com      | staff123   |

New workspaces can also self-register at `/register` — the **first** registered account automatically becomes `admin`.

### Development mode (hot reload)

```bash
npm.cmd run dev
```

Starts the Vite dev server (port 5173) and the API (port 5000) together; the Vite server proxies `/api/*` to the API automatically. Close the browser window to stop both, or set `NO_OPEN=1` to skip auto-opening.

### Reset the database

Delete `server/local.db` (or set `FORCE_SEED=1`) and re-run `npm.cmd run setup` / `npm.cmd run start` — the schema is pushed and demo data re-seeded.

## Features

- 🔐 JWT auth with role-based access (`admin`, `manager`, `staff`); the UI's role gates are mirrored server-side
- 📊 Dashboard — live revenue chart, service breakdown, booking status breakdown, upcoming bookings, insights
- 📅 Booking management — create, edit, reschedule, assign staff, track status & payment
- 🚿 Wash-floor operations — wash packages (with per-vehicle-type pricing), service bays, and the full `WashOrder` lifecycle: queue → bay assignment → wash → quality check → checkout, with a live bay board (`/wash-queue`) and per-role floor views (`/floor` "My Queue", `/checkout`)
- 👥 Customer directory — vehicle history, loyalty points, visit tracking, 360° profile
- 💳 Memberships — plans CRUD and subscriptions with pause/resume/cancel; real billing via Stripe when configured (see Integrations)
- 🧾 Support tickets — damage claims, billing disputes, quality complaints, with SLA-status indicators and a staff comment thread
- 🧑‍💼 HR — employee roster (distinct from login roles), shift scheduling with clock-in/out and late flags, leave requests
- 📦 Inventory & purchasing — supplies with per-package consumption tracking, stock adjustments, purchase orders (`Draft → Sent → PartiallyReceived → Received → Closed`)
- 💵 Expenses — categorized expense tracking
- 📈 Reports — revenue trends, booking status breakdown, top services
- 🔔 Notifications — in-app alerts for admin/manager (queue backups, bay downs, membership payment failures, ...)
- 📱 Fully responsive UI — mobile drawer navigation, adaptive tables/cards, touch-friendly forms

## Project structure

```
Carwash-Business-Software/
├── carwash-compile/    Compiled SplashPoint business-OS spec (reference only)
├── server/             Express API (REST, JWT auth, SQLite via Drizzle ORM)
│   ├── static/         Built React app — served by Express when present
│   ├── local.db        SQLite database file (created on first setup/start)
│   └── src/
│       ├── db/         Drizzle table schema + libSQL client
│       ├── controllers/  Route handlers / business logic
│       ├── routes/     Express routers
│       ├── services/   Shared logic (e.g. membership, inventory)
│       ├── utils/      Automations, WhatsApp, notifications, seed script
│       └── middleware/ Auth guard, error handler
├── client/             React (Vite) SPA — builds into server/static
│   └── src/
│       ├── pages/      Route-level screens
│       ├── components/ Layout, shared & feature UI components
│       ├── context/    Auth context/provider
│       └── api/        Axios client + resource API modules
├── scripts/            setup.cjs / dev.cjs (one-command tooling)
├── start-cw.cmd        Windows double-click launcher
└── package.json        Root scripts: setup / build / serve / start / dev
```

> Dockerfile(s) for `server/` and `client/` and the old `docker-compose.yml` predate the single-process + SQLite move and are **obsolete** — they reference PostgreSQL and a separate client container. Remove them if you don't use Docker; see "What is not in this app" below.

## Environment variables

**server/.env** (created automatically from `.env.example` on first run):

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `5000`) |
| `LIBSQL_URL` | SQLite database location (default `file:local.db`, i.e. `server/local.db`) |
| `JWT_SECRET` | Secret used to sign JWTs (change it) |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `CLIENT_URL` | Allowed CORS origin (dev only — same-origin in prod) |
| `STRIPE_SECRET_KEY` | Optional — enables real membership billing via Stripe Checkout/subscriptions. Omit to run membership signup as a local demo. |
| `STRIPE_WEBHOOK_SECRET` | Optional — required for `/api/webhooks/stripe` to process events (payment success/failure); without it the endpoint responds 501 even if `STRIPE_SECRET_KEY` is set. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional — enables real WhatsApp Cloud API sends (automations + membership dunning/welcome). Omit to log every send attempt to `customer_messages` with `status: not_configured`. |
| `WHATSAPP_API_VERSION` | Optional, defaults to `v21.0`. |

**client/.env** (optional — none required):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL for API calls (default `/api`, same-origin) |

## API overview

All endpoints are prefixed with `/api` and (except `/auth/login`, `/auth/register`, `/health`, and the Stripe webhook) require an `Authorization: Bearer <token>` header. Put `(admin/manager)` next to routes restricted by role.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users | `GET/POST /users`, `GET/PUT/DELETE /users/:id` (mutations admin-only) |
| Customers | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Vehicles | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id`, `GET /vehicles/plate/:plate` |
| Services | `GET/POST /services`, `GET/PUT/DELETE /services/:id` (mutations admin/manager) |
| Bookings | `GET/POST /bookings`, `GET/PUT/DELETE /bookings/:id`, `PATCH /bookings/:id/status`, `PATCH /bookings/:id/payment` |
| Expenses | `GET/POST /expenses`, `PUT/DELETE /expenses/:id` |
| Dashboard | `GET /dashboard/summary`, `/revenue-chart`, `/service-breakdown`, `/status-breakdown`, `/upcoming-bookings`, `/insights` |
| Notifications | `GET /notifications`, `/notifications/unread-count`, `PATCH /notifications/:id/read`, `/notifications/read-all` |
| Wash packages | `GET/POST /wash-packages`, `GET/PUT/DELETE /wash-packages/:id` (each carries 3-tier per-vehicle pricing) |
| Service bays | `GET/POST /service-bays`, `PUT/DELETE /service-bays/:id` |
| Wash orders | `GET/POST /wash-orders`, `GET /wash-orders/checkout-stats`, `GET /wash-orders/customer-messages` (admin/manager), `GET/DELETE /wash-orders/:id`, `PATCH /wash-orders/:id/{assign-bay,start-wash,complete-wash,qc,checkout,cancel}` |
| Membership plans | `GET/POST /membership-plans`, `GET/PUT/DELETE /membership-plans/:id` (mutations admin/manager) |
| Membership subscriptions | `GET/POST /membership-subscriptions`, `PATCH /membership-subscriptions/:id/{pause,resume,mark-paid,cancel}` |
| Tickets | `GET/POST /tickets`, `GET /tickets/:id`, `PATCH /tickets/:id/{status,assign}`, `POST /tickets/:id/comments` |
| HR | `GET/POST /hr/employees`, `GET/PUT/DELETE /hr/employees/:id`, `GET/POST /hr/shifts`, `PUT/DELETE /hr/shifts/:id`, `PATCH /hr/shifts/:id/{clock-in,clock-out}`, `GET/POST /hr/leave-requests`, `PATCH /hr/leave-requests/:id/decision` (admin/manager) |
| Inventory | `GET/POST /inventory/supplies`, `PUT/DELETE /inventory/supplies/:id`, `GET/POST /inventory/adjustments`, `GET/POST /inventory/purchase-orders`, `GET /inventory/purchase-orders/:id`, `PATCH /inventory/purchase-orders/:id/{approve,receive,close}` (admin/manager) |
| Integrations | `GET /integrations/status` — whether Stripe/WhatsApp are configured (shown on `/memberships`) |
| Stripe webhook | `POST /api/webhooks/stripe` (unauthenticated — Stripe's own HMAC signature is the auth, not a bearer token) |
| Health | `GET /api/health` |

## Integrations (optional, demo-mode by default)

The app runs fully without any real accounts — membership billing and WhatsApp messaging degrade to an explicit local demo instead of failing:

- **Stripe — membership billing.** With `STRIPE_SECRET_KEY` set, a "New membership" signup redirects to a hosted Stripe Checkout Session and `POST /api/webhooks/stripe` drives the subscription's Active ↔ Past-Due / Suspended / Cancelled lifecycle from real `invoice.payment_failed`, `invoice.payment_succeeded`, and `customer.subscription.deleted` events. Without it, signup creates the subscription locally as `active` with no real charge — clearly labeled "demo mode" in the UI. (The past-due → suspend → cancel thresholds are evaluated deterministically on each webhook event, not by an external agent.)
- **WhatsApp Cloud API — customer messaging.** Automations (`notify-ready-for-pickup`, membership welcome/dunning) attempt a real template send when `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` are set (named templates must still exist and be Meta-approved). Otherwise every attempt is recorded in `customer_messages` with `status: not_configured`, so the audit trail stays intact either way.
- `GET /api/integrations/status` reports live connection state.

## What is in this app (module notes)

These are kept deliberately simple and deterministic — no background schedulers, no external AI calls:

- **Wash floor lifecycle** — queue entry → auto bay assignment (matched to the package's tunnel/detail-bay lane) → start → complete → quality check (pass → ready for pickup; fail → rework) → checkout, plus cancel from queued/bay-assigned. State transitions are enforced server-side (`washOrderController.js`).
- **Role-based floor views** — `/floor` "My Queue" (any floor role): next queued vehicles, next open bay, one-tap log/assign/start/complete/QC. `/checkout` (any role): ready-for-pickup queue + today's revenue split. `/wash-queue` (admin/manager): the full 6-bay status board and order history.
- **Automations** (`server/src/utils/automations.js`) — deterministic reactions: `notify-ready-for-pickup` (WhatsApp template or logged attempt), `queue-wait-alert` (admin/manager notify when queue > 8 or predicted wait > 20 min, deduped per 15-min window), `bay-down-reroute` (reroute or requeue affected orders, escalate mid-service ones), and membership dunning/welcome messages.
- **Support tickets** — open → in-progress → waiting-on-customer/resolved → closed with server-enforced transitions, per-category SLA deadlines computed live (risk shown in the UI), staff assignment, and a comment thread. Customer 360 profiles surface membership + ticket history alongside wash history.
- **HR & staffing** — employee roster (explicitly distinct from login roles), shift scheduling with clock-in/out and live late-flags, leave requests with approval.
- **Inventory & purchasing** — supplies with stock levels, stock adjustments (always require an employee approver), and purchase orders with approve → receive → close flow; per-package chemical consumption (`package_supply_usage`) informs reorder stock levels shown in the supplies list.

## What is not in this app

Kept out on purpose (removed from an earlier architecture) — these features are **not** present, and the UI/API/DB reflect that:

- **AI agents** — the 12-agent roster (queue-dispatch, wash-concierge chat, membership-billing, inventory-forecaster, ops-orchestrator, strategy-advisor, system-health, fleet-lead-scorer, review-response, predictive-maintenance, quality-anomaly, phone-line) and the Anthropic SDK. No `config/anthropic.js`, no `agents/` folder, no agent tables. The behavior that needed judgment defaults to deterministic code (e.g. the queue-wait alert uses a fixed recommendation message).
- **WhatsApp inbound webhook / chat agent** — the `/api/webhooks/whatsapp` endpoints and concierge conversation tables. WhatsApp remains **outbound only** (automation templates).
- **Double-entry accounting ledger** — chart of accounts, journal entries/lines, and the `/ledger`, `/finance`, and P&L surfaces. Routine money flows (checkout, membership charges, expenses, payroll, purchasing) are no longer auto-posted to a ledger; the `expenses` table remains the record of spend.
- **Payroll runs** — wage/commission computation and the `/hr/payroll-runs` endpoints. HR keeps employees, shifts, and leave.
- **Simulations & forecasting** — the five models under `/simulations` (also removed the `/inventory/forecast` passenger-and-reorder endpoint and forecast tab).
- **Growth automations** — customer segmentation, fleet-lead scoring, review-response, and the `/growth` pages (segments/fleet-inquiries/reviews) and their tables. Referral codes are still generated for customers and loyalty points are still credited on checkout, but the auto-credit-on-first-wash referral tie-in was removed.

**Also note:** the app has no job scheduler — everything that could be "nightly/weekly" (reorder recommendations, SLA reminders, drip campaigns) is either on-demand or computed live on read. RBAC covers the three login roles (`admin`/`manager`/`staff`); `Employee.position` records job titles but doesn't yet restrict screens per the spec's full role breakdown.

## Responsiveness

Every screen adapts across breakpoints:

- Sidebar navigation collapses into a slide-over drawer with a hamburger toggle on mobile/tablet.
- Data tables scroll horizontally on narrow viewports instead of breaking layout.
- Stat cards, forms, and charts reflow from 1 → 2 → 4 column grids using Tailwind's responsive utilities.
- Modals dock to the bottom of the screen on mobile and center on desktop.