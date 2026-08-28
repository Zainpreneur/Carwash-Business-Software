# SplashPoint Express Wash — Business Operating System

*A full business-compiler output. Root: `bir.json`. Compiled 2026-08-28.*

## Executive summary

SplashPoint Express Wash is a single-location, 6-bay car wash (4 tunnel-conveyor bays for
express/exterior-plus washes, 2 detail bays for hand-wax/interior detailing) serving
individual drivers, with a small commercial/fleet segment. Revenue runs mostly on monthly
unlimited membership subscriptions plus pay-per-wash retail tickets, with fleet accounts on
net-15 invoicing. The core lifecycle - a vehicle queues, gets assigned a bay and technician,
runs a wash cycle, clears quality check, and checks out (paid or membership-verified) - is
run by a ~15-20 person floor staff and backed by 12 AI agents covering queue dispatch,
membership billing, IoT-driven predictive maintenance, and customer conversation. The
business is built to know, in dollars, both what a broken tunnel motor costs it and whether
its unlimited membership plan is actually profitable at the wash-through rates members
really use it at.

## Table of contents

**Foundation** - the base layer
- `01-foundation/data-model.md` — 24 entities, 6 state machines, 7 executable workflows covering the wash lifecycle, membership enrollment, cancellation/refund, staffing, reorder, and predictive maintenance
- `01-foundation/dashboards.md` — Forms, queue/status views, and KPI tiles for all 7 human roles, from the bay-floor field view to the owner's WhatsApp digest
- `01-foundation/security.md` — RBAC for 7 human roles + 12 AI agents, 4 ABAC policies, sensitive-field handling, audit scope, and compliance notes (PCI, wastewater permitting)

**Intelligence** - the brain
- `02-intelligence/analytics.md` — The reporting cube (7 dimensions, 10 measures), financial statements, cohort retention analysis, benchmarking, 4 anomaly rules, a weighted health score, and 3 scheduled digests
- `02-intelligence/views.md` — 8 audience-specific views (Owner, Site Manager, Financial, Customer/CRM, Team, Growth, Technical w/ Mermaid diagrams, Field/Bay Floor)
- `02-intelligence/ai-agents.md` — The 12-agent workforce: 1 orchestrator, 2 advisors (strategy + system-health), 7 specialists, 2 task agents — headlined by `predictive-maintenance-agent` and `queue-dispatch-agent`
- `02-intelligence/simulation.md` — 7 forecasting/simulation models, headlined by the membership-economics profitability model (breakeven wash-through math) and the downtime-cost simulator, plus 5 named what-if scenarios
- `02-intelligence/data-aggregation.md` — 4 external analytics sources blended into the cube, plus 4 cross-source analyses including true net membership margin and the ROI case for the IoT sensor investment itself

**Operations** - day-to-day running
- `03-operations/automations.md` — 11 automations + 6 reminder rules, with a traced anti-spam check
- `03-operations/inventory.md` — Chemical/consumable stock tracking, 3 suppliers, reorder policy, shrinkage handling
- `03-operations/assets-iot.md` — 7 equipment types, 5 IoT-telemetry-monitored assets, preventive maintenance schedules, and the predictive-maintenance agent's drift-vs-spike reasoning
- `03-operations/hr.md` — Employee lifecycle, shift scheduling tied to the demand forecast, compensation models (incl. detail-technician commission), payroll pipeline, leave policy

**Growth** - the customer-facing engine
- `04-growth/whatsapp.md` — 7 message templates, 6 conversational flows, and the consent model for a business where WhatsApp is the primary customer channel
- `04-growth/social-media.md` — 4 platforms, 5 content pillars, publishing pipeline, listening/engagement rules
- `04-growth/marketing.md` — 7 segments, the funnel, lifecycle campaigns, 2 drip sequences, paid ads, an A/B test, loyalty/referral, and the attribution model
- `04-growth/crm.md` — A deliberately light-touch sales path for the fleet segment (lead scoring, no formal pipeline) plus full support ticketing with SLAs and a customer-360 view

**Finance** - the ledger
- `05-finance/accounting.md` — 21-account chart of accounts, native double-entry ledger with worked auto-posted journal entries, tax, banking/reconciliation, budgets, period close, and loyalty-point liability treatment

**Platform** - knowledge, integrations, and the API surface
- `06-platform/knowledge-base.md` — 9 document types, KB grounding for the 3 customer-facing agents, storage and e-signature notes
- `06-platform/integrations.md` — 9 third-party integrations (payments, accounting, calendar, reviews, messaging, web/ad analytics, IoT telemetry, weather, and a generic webhook escape hatch)
- `06-platform/api-webhooks.md` — This business's own REST API and 4 outbound webhook events, for the fleet segment and future partners to integrate against

**Delivery**
- `07-delivery/deployment-guide.md` — Recommended stack, an 8-step build order, and a rollout/go-no-go plan including a phased IoT sensor rollout
- `07-delivery/qa-report.md` — The Stage 4 QA pass: 2 fixes made (an unhappy-path gap, a revenue/tax consistency clarification), everything else checked clean

## Key decisions (`meta.assumptions`)

- Single physical site with 4 express-tunnel/conveyor bays plus 2 full-service detail bays (6 bays total) — read from "service bays, technician queues" as a multi-bay express/full-service hybrid, not a single-bay operation.
- Revenue is a mix of pay-per-wash retail tickets and monthly unlimited membership subscriptions (the dominant modern car-wash business model), plus a small walk-up B2B/fleet segment — not a formal B2B sales org.
- Vehicle types priced in 3 tiers: sedan/coupe, suv-truck, van-oversized (motorcycles/oversized commercial rigs out of scope, quoted manually).
- Full-service/detail bay work is appointment-capable; express tunnel wash is walk-in/queue only.
- IoT sensors are installed on the highest-value, highest-downtime-cost equipment (tunnel conveyor motor, water reclaim system, boiler, air compressor, dryer blowers) — not on every hand tool.
- The business already has a POS/payment processor and a Google Business Profile; no existing loyalty program to migrate from.
- Located in a single US state for this compile (sales tax + labor law scoped to one jurisdiction) — multi-state/franchise expansion would recompile `meta.scale` and the tax/HR sections.
- No formal B2B sales pipeline compiled — fleet/commercial interest is handled via lightweight lead scoring and a human follow-up task, not a staged deal pipeline, per the "mostly walk-in business" guidance in `17-crm-sales-support.md`.

## Status

**QA pass**: complete. Business logic, AI logic, integrations/API/security logic, and
coverage against the original ask were all checked per `references/22-qa-and-completeness.md`.
2 fixes were made during the pass (an unhappy-path gap in two workflow steps; a revenue/tax
definition consistency clarification between the analytics cube and the ledger). No genuine
ambiguity requiring a human decision was found. Full detail in `07-delivery/qa-report.md`.

**Validator** (`scripts/validate_bir.py`): clean.
```
⚠️  2 warning(s) — both confirmed style-only (two entities each have two legitimate terminal
states; the mechanical check only exempts the last array entry)
✅ No broken references.
```

This package is ready to hand to an engineering team or feed back into Claude Code to
scaffold, per `07-delivery/deployment-guide.md`'s build order.
