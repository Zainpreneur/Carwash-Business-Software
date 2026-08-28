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
| Wash orders  | `GET/POST /wash-orders`, `GET/DELETE /wash-orders/:id`, `PATCH /wash-orders/:id/{assign-bay,start-wash,complete-wash,qc,checkout,cancel}` |

## SplashPoint Wash Queue (spec Phase 1)

`carwash-compile/` is a compiled business-OS spec for a fictional 6-bay wash, "SplashPoint
Express Wash" (see `carwash-compile/00-index.md`). Its own deployment guide recommends building
in phases rather than all at once; **Phase 1 — the data model and primary wash lifecycle — is
built and live** as an additive module alongside the existing booking-based app:

- **Data model**: `WashPackage` (+ 3-tier `PackagePricing`), `ServiceBay`, `WashOrder` — see
  `carwash-compile/01-foundation/data-model.md` for the source spec.
- **Lifecycle** (`/wash-queue` in the sidebar): queue-entry → auto bay assignment (matched to
  the package's tunnel/detail-bay lane) → start wash → complete wash → quality check
  (pass → ready for pickup, fail → looped back to rework) → checkout, plus cancel from
  Queued/BayAssigned. State transitions are enforced server-side (`washOrderController.js`).
- **Not built yet** (later phases per the spec's own build order): role-specific dashboards
  beyond this single queue view, RBAC beyond the existing admin/manager/staff roles,
  `MembershipSubscription` billing, AI agents, IoT/predictive maintenance, WhatsApp/social/CRM,
  the accounting ledger, and HR/payroll.

## Responsiveness

Every screen adapts across breakpoints:

- Sidebar navigation collapses into a slide-over drawer with a hamburger toggle on mobile/tablet.
- Data tables scroll horizontally on narrow viewports instead of breaking layout.
- Stat cards, forms, and charts reflow from 1 → 2 → 4 column grids using Tailwind's responsive utilities.
- Modals dock to the bottom of the screen on mobile and center on desktop.
