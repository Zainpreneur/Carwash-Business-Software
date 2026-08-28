# Deployment Guide

*Part of the Delivery cluster. Compiled from `bir.json`.*

A path from this spec to a running system a small team (or a solo founder plus Claude Code)
could actually build, sized to a single-location business with real physical/IoT integration
- not over-engineered into microservices, not under-specced into a spreadsheet.

---

## 1. Recommended stack

| Layer | Recommendation |
|---|---|
| Data | Postgres (Supabase as the default - auth, storage, and edge functions out of the box; a Supabase MCP connector is available in this session if the user wants direct provisioning) |
| Backend | Typed backend (Node/TypeScript), `01-foundation/data-model.md` as the schema source of truth |
| Frontend | Component framework matching the mobile/desktop split in `01-foundation/dashboards.md` - mobile-first PWA for bay-attendant/technician field views, desktop web for back-office/financial views |
| AI agents | Claude Agent SDK / Claude API - each agent in `02-intelligence/ai-agents.md` as a scoped tool-use loop with its guardrails enforced in code, not just in the prompt |
| Automations | A queue + scheduled-job runner driven off entity state-change events (or the connected Make/Zapier MCPs if the user prefers a no-code layer) |
| WhatsApp | WhatsApp Business Cloud API direct, per `04-growth/whatsapp.md` |
| IoT ingestion | MQTT broker or the sensor vendor's own API feeding `wash-sensor-platform`, landing into a time-series-friendly store (Postgres + TimescaleDB extension, or a dedicated time-series store if telemetry volume grows) |
| Voice | A telephony/voice API (e.g. Twilio Voice or similar) behind `phone-line-agent`'s `voice.call`/`voice.transcribe` tools |
| Hosting | Railway/Vercel/Netlify - all available as connectors in this session if the user wants direct provisioning |

## 2. Build order

1. **Data model + primary lifecycle** - `WashOrder`, `Vehicle`, `Customer`, `ServiceBay`
   end-to-end (queue -> bay assignment -> wash -> checkout) before anything else. Demoable as
   soon as one vehicle can be logged, washed, and checked out.
2. **Role-based UI for the primary workflow** - bay-attendant queue entry, cashier checkout,
   site-manager bay-status board.
3. **Security (RBAC minimum)** - not deferred; retrofitting permissions onto a built system is
   expensive, and payment/PII fields need it from day one.
4. **Automations + reminders for the primary lifecycle** - `notify-ready-for-pickup`,
   `queue-wait-alert`, `bay-down-reroute`.
5. **Integrations required to actually operate** - Stripe first (money moves through the
   system from day one, both pay-per-wash and membership billing), then WhatsApp Cloud API,
   then the wash sensor platform once IoT hardware is installed.
6. **AI agents, highest-leverage first** - `queue-dispatch-agent` (the highest-toil manual
   task on a busy day) and `wash-concierge` (the highest-volume customer-facing surface),
   then `membership-billing-agent`, then `predictive-maintenance-agent` once telemetry is
   flowing, then the rest of the roster.
7. **WhatsApp flows, social suite, marketing/CRM** - membership sign-up flow, drip sequences,
   loyalty/referral.
8. **Simulation/forecasting** - benefits from having 8+ weeks of real `WashOrder`/
   `MembershipSubscription` data flowing already, per `02-intelligence/simulation.md`'s
   calibration notes; ship it with clearly-labeled industry-benchmark defaults from day one
   and let it sharpen as real data accumulates.

## 3. Rollout plan

- **Pilot**: run the tunnel queue + checkout flow through one full week manually shadowed by
  the paper/existing process before flipping automations to live, especially
  `notify-ready-for-pickup` and `membership-payment-failed-dunning` - a bad automation firing
  at full customer volume is expensive to walk back on a WhatsApp channel.
- **IoT rollout**: install sensors on the tunnel-conveyor-motor and water-reclaim-ro-system
  first (highest downtime cost), let `predictive-maintenance-agent` run in
  notify-only/shadow mode for 2-4 weeks to calibrate each asset's "normal range" baseline
  before letting it auto-create `MaintenanceOrder`s.
- **Data migration**: if replacing an existing POS/membership system, map existing member
  records to `Customer`/`Vehicle`/`MembershipSubscription` before cutover; run both systems in
  parallel for one full billing cycle so no member's billing date is dropped.
- **Go/no-go checklist before any agent goes fully autonomous** (vs. human-approval-required):
  guardrail thresholds reviewed by `site-manager`, at least 2 weeks of shadow-mode logs
  reviewed with zero unintended irreversible actions, WhatsApp message templates approved by
  Meta, `system-health-agent`'s first weekly report reviewed once the roster is live.

## 4. What's not built yet

Multi-location/franchise support is deliberately out of scope for this compile
(`meta.scale: single-location`) - the ABAC branch-scoping policy in
`01-foundation/security.md` and the `Warehouse` model in `03-operations/inventory.md` are
already shaped to extend to a second site without a rebuild, but a recompile against an
updated `meta.scale` is the right trigger for that, not building it speculatively now.
