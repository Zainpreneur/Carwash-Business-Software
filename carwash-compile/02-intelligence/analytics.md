# Advanced Business Analytics & Reporting

*Part of the Intelligence cluster. Compiled from `bir.json`.*

The reporting cube is built to answer the two questions that actually run a car wash day to
day: is the tunnel keeping up with the queue, and is the membership base growing faster than
it churns. Everything else (chemical cost, technician throughput, review rating) feeds those.

---

## The reporting cube

**Dimensions**: Time, Bay, VehicleType, PackageTier, Channel (walk-in / membership / fleet /
app), Technician, PaymentMethod.

**Measures**: Revenue, WashCount, AverageOrderValue, GrossMargin, BayUtilization,
MembershipMRR, WashThroughRate, MembershipChurnRate, ChemicalCostPerWash, EquipmentUptimeRate.

| Report | Measures | Dimensions | Cadence |
|---|---|---|---|
| `revenue-by-bay-daily` | Revenue, WashCount | Bay, Time | daily |
| `membership-mix-weekly` | Revenue, WashCount | PaymentMethod, Time | weekly |
| `package-tier-margin` | GrossMargin, ChemicalCostPerWash | PackageTier | weekly |
| `aov-by-vehicle-type` | AverageOrderValue | VehicleType | monthly |
| `technician-throughput` | WashCount, BayUtilization | Technician, Time | weekly |
| `equipment-uptime-by-asset` | EquipmentUptimeRate | Time | weekly |

**Revenue measure definition** (kept consistent with the ledger): `WashOrder.price` is the
total amount charged, *tax-inclusive*. The `Revenue` measure everywhere in this cube -
`revenue-by-bay-daily`, `revenue-per-vehicle`, the health score, and the P&L - is `price` net
of its embedded sales-tax portion, the same net figure `05-finance/accounting.md`'s
`4000/4100/4200` revenue accounts recognize (a $22.00 charge posts $20.28 to Revenue and
$1.72 to `Sales Tax Payable`, per that file's worked journal entry). Reports never sum raw
`price` as Revenue - that would silently double-count collected tax as revenue and disagree
with the ledger's P&L by the tax rate every time.

A note on `revenue-per-vehicle` (the KPI in `bir.json`): for a membership wash it's the plan's
`monthlyPrice` amortized across that cycle's `washesThisCycle` (not treated as $0 just because
no `Payment` was collected that visit) - this is what keeps `revenue-per-vehicle` here and the
health score's membership-penetration component computed from the *same* underlying number
rather than two modules silently disagreeing on what a membership wash is worth.

---

## Financial statements

| Statement | Source |
|---|---|
| Profit & Loss | Revenue from `WashOrder`/`Invoice` (Completed/Paid) + `MembershipSubscription` billing; COGS from `Supply` consumption; Opex from `Employee`/`Shift` payroll + integration costs; native, not from an external accounting product |
| Cash Flow | Actual `Payment` inflow vs. payroll runs + supplier `PurchaseOrder` payments - diverges from P&L mainly on fleet net-15 `Invoice` lag |
| AR Aging | Fleet `Invoice`s only (pay-per-wash and membership are collected at time of service) - buckets current/15/30/45+ |

No Balance Sheet compiled - single-location scale doesn't yet warrant one; revisit if the
business adds a second site.

---

## Cohort & retention analysis

- **By membership signup month**: repeat-visit and cancellation rate by cohort - this is the
  single most useful chart in the whole package for a membership-driven car wash, since
  `net-membership-growth` alone can mask a base that's churning fast and being refilled by
  acquisition at the same rate.
- **By first-wash acquisition channel**: does a customer who first washed via a Meta Ads
  geo-radius promo convert to membership at a different rate than one from a Google Business
  Profile review click?

---

## Benchmarking

- **Internal baseline**: WoW/MoM/YoY on every measure above, available once ~8 weeks of data
  exists (see `simulation.md`'s calibration note).
- **External/industry benchmark** (clearly labeled, not this business's real number): typical
  express car wash membership penetration 55-70% of wash volume at maturity; typical gross
  margin 60-70%; typical monthly membership churn 8-12%. Useful for a newly opened site with
  no history yet.

---

## Anomaly detection

| Rule | Routes to |
|---|---|
| `avg-wait-time-minutes` moves >2 std. dev. above its trailing 4-week baseline for the same hour-of-day/day-of-week | `queue-wait-alert` automation -> site-manager |
| Membership cancellation count in a week exceeds 2x the trailing 8-week average | `strategy-advisor` (root-cause-5-whys) |
| `chemical-cost-per-wash` rises >15% WoW with no corresponding package-mix shift | site-manager + `strategy-advisor` |
| An Asset's telemetry-flagged anomaly count doubles WoW (possible sensor fault or genuine accelerating wear) | `predictive-maintenance-agent` + site-manager |

---

## Business health score

Weighted composite surfaced on the Executive View:

| Component | Weight |
|---|---|
| membership-penetration-rate | 0.30 |
| bay-utilization-rate | 0.25 |
| net-membership-growth | 0.20 |
| avg-review-rating | 0.15 |
| equipment-uptime-rate | 0.10 |

Weighting is intentionally visible and editable by `owner` - membership penetration and bay
utilization dominate because they're the two levers that most directly predict this
business's monthly cash flow.

---

## Scheduled digests

| Digest | Audience | Cadence | Channel |
|---|---|---|---|
| `owner-daily-digest` | owner | daily | whatsapp |
| `site-manager-morning-brief` | site-manager | daily | in-app |
| `owner-weekly-health-report` | owner | weekly | email |
