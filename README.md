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

## SplashPoint Wash Queue (spec Phases 1, 2 & 4)

`carwash-compile/` is a compiled business-OS spec for a fictional 6-bay wash, "SplashPoint
Express Wash" (see `carwash-compile/00-index.md`). Its own deployment guide lays out an
8-step build order; **steps 1–4 are built and live** as an additive module alongside the
existing booking-based app — (1) the data model + primary wash lifecycle, (2) role-based UI,
(3) RBAC (folded into the Phase 2 work), and (4) the lifecycle's automations. Step 5
(integrations — Stripe, WhatsApp Cloud API, the wash-sensor platform) needs real third-party
accounts/credentials this session doesn't have, so it's still ahead — see "Not built yet"
below.

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
  - `notify-ready-for-pickup` — fires on QC pass, gated by `Customer.whatsappOptIn`. No real
    WhatsApp Cloud API yet (needs Meta Business credentials — a later phase), so it logs the
    decision to a `customer_messages` audit table (`GET /wash-orders/customer-messages`,
    admin/manager) instead of silently doing nothing.
  - `queue-wait-alert` — notifies admin/manager when queue length > 8 or predicted wait
    > 20 min, deduped to at most one alert per 15-minute window.
  - `bay-down-reroute` — when a bay's `operationalStatus` flips to `down`, any order already
    `bay-assigned` there is rerouted to another open bay in the same lane, or requeued if
    none is free; orders already mid-wash/QC on it are escalated to admin/manager instead of
    silently moved, since a wash in progress can't be safely relocated.
- **Not built yet** (later phases per the spec's own build order): Stripe/WhatsApp Cloud
  API/IoT-sensor integrations (step 5 — needs real third-party credentials), AI agents,
  `MembershipSubscription` billing, social/marketing/CRM, the accounting ledger, and
  HR/payroll — and RBAC only covers this app's existing admin/manager/staff roles, not the
  spec's full 7-role breakdown (Owner/Site Manager/Bay Attendant/Wash Technician/Detail
  Technician/Cashier/Fleet Account Manager), which would need its own `Employee` entity.

## Responsiveness

Every screen adapts across breakpoints:

- Sidebar navigation collapses into a slide-over drawer with a hamburger toggle on mobile/tablet.
- Data tables scroll horizontally on narrow viewports instead of breaking layout.
- Stat cards, forms, and charts reflow from 1 → 2 → 4 column grids using Tailwind's responsive utilities.
- Modals dock to the bottom of the screen on mobile and center on desktop.
