# Multiple Views

*Part of the Intelligence cluster. Compiled from `bir.json`.*

Eight views compiled - single-location scale collapses what would be a separate Board View
into the Executive View, but keeps Field/Technical distinct because the wash floor and an
engineering audience genuinely need different things from everyone else.

---

## Executive/Owner View
**Audience**: `owner` · **Cadence**: daily (real-time available) · **Medium**: whatsapp-digest

Leads with the health score, then `cars-washed-per-day`, `membership-penetration-rate`,
`net-membership-growth`, then *only* open anomaly alerts - never raw data. Includes:
`healthScore`, `cars-washed-per-day`, `membership-penetration-rate`, `net-membership-growth`,
`revenue-by-bay-daily`, open anomaly alerts.

## Operations View
**Audience**: `site-manager` · **Cadence**: real-time · **Medium**: in-app

The busiest screen in the system. Includes: today's `WashOrder` queue by status, the 6-bay
status board, `shift-no-show-alert` list, open `MaintenanceOrder`s, open `Ticket`s.

## Financial View
**Audience**: `owner` · **Cadence**: monthly · **Medium**: emailed-report

Includes: profit-and-loss, cash-flow, ar-aging, `package-tier-margin`, budget-vs-actual.

## Customer/CRM View
**Audience**: `site-manager` · **Cadence**: weekly · **Medium**: in-app

Includes: segment sizes and movement, at-risk-member list, campaign performance,
`crm.customer360Includes`.

## Team/HR View
**Audience**: `site-manager` · **Cadence**: weekly · **Medium**: in-app

Includes: `Shift` schedule and coverage gaps, `technician-throughput`, payroll status.

## Growth/Marketing View
**Audience**: `owner` · **Cadence**: weekly · **Medium**: in-app

Includes: funnel stage volumes, `marketing.adCampaigns` ROI, social-media analytics,
`true-blended-cac` (from `data-aggregation.md`).

## Field/Mobile View (Bay Floor)
**Audience**: `bay-attendant` (and by extension wash-technician/detail-technician) ·
**Cadence**: real-time · **Medium**: in-app

Minimal, action-oriented, works on a phone, tolerant of poor connectivity (queues the
qc-passed/qc-failed action offline and syncs on reconnect - a wash bay's phone signal is not
guaranteed). Includes: queue board, assigned-technician-today list, one-tap qc-passed/
qc-failed action.

## Technical/Architecture View
**Audience**: engineering team · **Cadence**: on-demand · **Medium**: diagram

### Entity-relationship diagram (core entities)

```mermaid
erDiagram
    Customer ||--o{ Vehicle : owns
    Customer ||--o{ WashOrder : places
    Customer ||--o| MembershipSubscription : holds
    Vehicle ||--o| MembershipSubscription : "covered by"
    Vehicle ||--o{ WashOrder : "washed in"
    WashPackage ||--o{ PackagePricing : "priced by vehicle type"
    WashPackage ||--o{ WashOrder : selected
    MembershipPlan ||--o{ MembershipSubscription : defines
    ServiceBay ||--o{ WashOrder : hosts
    ServiceBay ||--o{ Asset : contains
    Asset ||--o{ MaintenanceOrder : triggers
    Employee ||--o{ Shift : works
    Employee ||--o{ WashOrder : "assigned to"
    Supply ||--o{ Stock : "tracked in"
    Warehouse ||--o{ Stock : holds
    Supplier ||--o{ PurchaseOrder : fulfills
    WashOrder ||--o| Invoice : bills
    Invoice ||--o{ Payment : "paid by"
    Customer ||--o{ Ticket : files
```

### Agent org chart

```mermaid
graph TD
    OO[ops-orchestrator]
    SA[strategy-advisor]
    SH[system-health-agent]
    QD[queue-dispatch-agent]
    WC[wash-concierge]
    MB[membership-billing-agent]
    INV[inventory-forecaster]
    PM[predictive-maintenance-agent]
    QA[quality-anomaly-detector]
    RR[review-response-agent]
    FL[fleet-lead-scorer]
    PH[phone-line-agent]

    OO --> SA
    OO --> SH
    OO --> QD
    OO --> WC
    OO --> MB
    OO --> INV
    OO --> PM
    OO --> RR
    OO --> PH
    QD -.invokes.-> QA
    MB -.handoff.-> PH
    FL -.handoff.-> PH
```

### System/integration map

```mermaid
graph LR
    subgraph SplashPoint System
        WO[WashOrder / Customer / Asset entities]
        Agents[AI Agent workforce]
    end
    Stripe[Stripe - payments] <-->|bidirectional, real-time| WO
    QBO[QuickBooks Online] -->|outbound, nightly| WO
    GCal[Google Calendar] <-->|bidirectional| WO
    GBP[Google Business Profile] <-->|bidirectional| Agents
    WA[WhatsApp Cloud API] <-->|bidirectional, real-time| Agents
    GA[GA / Meta Pixel] -->|inbound, nightly| WO
    Sensor[Wash Sensor Platform - IoT] -->|inbound, real-time| Agents
    Weather[Weather API] -->|inbound, hourly| Agents
    Webhook[Generic custom webhook] <-->|bidirectional| WO
```

---

Medium/cadence choices were deliberate: the owner gets a WhatsApp digest (checking in between
tasks, not logging into a dashboard); the bay floor gets push-style in-app actions tolerant of
poor connectivity, not the full back-office UI shrunk down; the Financial View is an emailed
report because monthly review happens off-shift, not glanced at mid-shift.
