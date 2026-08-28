# Simulation & Forecasting

*Part of the Intelligence cluster. Compiled from `bir.json`.*

Seven models. The two that matter most for a membership-driven car wash - and that get the
deepest treatment here - are the **bay-throughput/queue simulator** (can the physical plant
actually serve the demand) and the **membership-economics simulator** (is the unlimited plan
itself profitable once real wash-through behavior is accounted for, not just sticker MRR).
This is the profitability-simulation layer the business specifically asked for.

---

## demand-forecast

- **Inputs**: historical `WashOrder` counts by hour/day (rolling 12 weeks), day-of-week
  seasonality, `weather-api` precipitation/pollen overlay (car washes are unusually
  weather-elastic - a rainy day suppresses walk-in demand same-day, and a post-rain or
  post-pollen day spikes it 20-40% above baseline in most markets), the marketing campaign
  calendar from `04-growth/marketing.md`.
- **Method**: baseline day-of-week/hour-of-day volume curve, adjusted by a weather multiplier
  (rain: -35% to -60% same-day for pay-per-wash, membership visits drop less since they're
  "already paid for"; 2 days post-rain/high-pollen: +20-40%) and a promo-calendar bump for
  active campaigns.
- **Output**: expected volume ± confidence band per hour/day, shown on the Operations View's
  queue-board tile and the Owner digest.
- **Data requirement**: needs ~8 weeks of `WashOrder` history correlated against weather
  history before the weather multiplier is trustworthy; before that, show industry-benchmark
  seasonality defaults clearly labeled as such.

## bay-throughput-queue-simulator

- **Inputs**: bay count (4 tunnel positions + 2 detail bays), `WashPackage.avgCycleTimeMinutes`
  per tier, technician staffing from `Shift`, the demand forecast above.
- **Method**: models the tunnel as a single-server queue per effective "slot" (tunnel
  throughput is gated by the slowest station in the conveyor, not just bay count) and the
  detail bays as 2 independent servers; computes expected vehicles/hour capacity and expected
  queue wait at a given demand level and package mix.
- **Worked example**: 4-bay tunnel at a 3.5-minute average cycle (blended across
  express-exterior/exterior-plus mix) yields a theoretical ~17 vehicles/hour ceiling; at 85%
  of that ceiling (realistic sustained throughput once load/unload friction is counted),
  effective capacity is ~14.5 vehicles/hour. A Saturday demand forecast of 90 vehicles between
  10am-2pm (4 hours) against that 14.5/hr capacity implies the queue is *structurally*
  undersized for that window (needed ~15.5/hr) - this is exactly the kind of gap
  `queue-wait-alert` is built to catch in real time, and the `add-a-5th-tunnel-bay` scenario
  below is built to evaluate structurally.
- **Output**: expected wait-time curve by hour, shown on the Operations View bay-status board
  and feeding `queue-dispatch-agent`'s wait predictions.
- **Data requirement**: usable from day one on stated cycle-time assumptions; sharpens once 4+
  weeks of actual `washStartedAt`/`washCompletedAt` deltas are available per package tier.

## staffing-capacity-simulator

- **Inputs**: demand forecast, `bay-throughput-queue-simulator` output, current `Shift`
  schedule.
- **Method**: staff-hours needed = (forecasted vehicles/hour ÷ vehicles one bay-attendant +
  one wash-technician can service per hour at target wait time) summed across the day; flags
  under/over-staffing windows (e.g. Saturday 10am-2pm needs 2 bay-attendants + 3
  wash-technicians vs. the 1+2 currently scheduled).
- **Output**: coverage-gap tiles on the Team/HR View; feeds `shift-no-show-alert`.
- **Data requirement**: usable immediately from stated service-rate assumptions.

## cash-flow-forecast

- **Inputs**: `MembershipSubscription` MRR (recurring, low-variance), forecasted pay-per-wash
  revenue from the demand forecast, known outflow (biweekly payroll, chemical `PurchaseOrder`
  cadence, utilities, equipment-financing payment on `Equipment Financing Payable`).
- **Method**: weekly grid, membership MRR treated as near-certain inflow, pay-per-wash treated
  as demand-forecast-derived with its confidence band, outflow scheduled against known dates.
- **Output**: flags any projected negative-balance week early enough to act (e.g. delay a
  discretionary `PurchaseOrder`, or the `strategy-advisor` proposes deferring a
  non-critical `MaintenanceOrder` that isn't safety-critical).
- **Data requirement**: usable from day one on the membership base + stated demand forecast.

## membership-economics-simulator — the profitability core

This is the model a car wash owner actually needs and that a generic "subscription business"
template wouldn't get right: an unlimited-wash plan's profitability is driven entirely by
**wash-through rate** (how many times a member actually visits per month), not by the sticker
`monthlyPrice`.

- **Inputs**: `MembershipPlan.monthlyPrice` per tier, `MembershipSubscription.washesThisCycle`
  distribution (the wash-through-rate KPI), variable cost per wash (chemicals + water/energy +
  labor-minutes at that package's `avgCycleTimeMinutes`), `marketing.adCampaigns`/
  organic-channel spend per new signup (CAC), and observed `MembershipSubscription` cancel
  rate by tenure (for LTV).
- **Method**:
  1. **Variable cost per wash** (worked example, `basic-unlimited` tier ≈ `express-exterior`
     package): chemicals ~$0.85, water/energy ~$0.40, labor (tunnel technician time allocated
     per vehicle at ~14.5 veh/hr effective throughput and a blended $16/hr wash-technician
     wage) ~$1.10 → **≈ $2.35 variable cost per wash**.
  2. **Breakeven wash-through rate** = `monthlyPrice` ÷ variable cost per wash. At a
     `basic-unlimited` price of $24.99/month, breakeven is **≈ 10.6 washes/month**. A member
     washing more than ~10-11 times a month is running the plan at a loss on variable cost
     alone (before even allocating fixed capacity cost) - a real, well-known dynamic in the
     unlimited-wash industry, not a hypothetical edge case.
  3. **Typical wash-through distribution** (industry-benchmark default until this business has
     8+ weeks of its own `washesThisCycle` data): median member washes ~3.2x/month, top
     decile washes 8-12x/month - meaning the plan is comfortably profitable in aggregate *as
     long as the top-decile heavy-users don't grow disproportionately*, which is exactly what
     `wash-through-rate`'s trend (not just its average) should be watched for.
  4. **LTV** = avg monthly contribution margin per member (`monthlyPrice` - avg variable cost
     at the observed wash-through rate) × avg tenure in months (derived from the observed
     cancel-rate curve, not assumed).
- **Output**: a per-tier profitability tile (breakeven wash-through line vs. actual
  distribution) on the Financial View; feeds `strategy-advisor`'s `unit-economics` reasoning
  pattern directly when the owner asks pricing questions.
- **Calibration/honesty**: the variable-cost figures above are stated, editable assumptions,
  not measured - label them as such until the business's own `Supply` consumption and payroll
  data replace them, per `11-simulation-forecasting.md`'s calibration rule.
- **Data requirement**: usable immediately on stated assumptions; the wash-through
  *distribution* (not just the average) needs ~8 weeks of `washesThisCycle` history before
  it's trustworthy - a thin early sample will understate the heavy-user tail.

## pricing-scenario-simulator

- **Inputs**: current package/plan mix, `membership-economics-simulator` output, a stated
  price-elasticity assumption (elasticity is inherently approximate - stated explicitly rather
  than presented as measured).
- **Method**: models revenue/margin impact of a price change or a new package tier against
  current mix, at a stated elasticity assumption (default: -0.3 for membership price changes
  in a market with 1-2 direct competitors, i.e. a 10% price increase costs ~3% of the member
  base to churn/not-convert - this is a labeled assumption, not derived).
- **Output**: revenue/margin delta by scenario, shown to `strategy-advisor` when asked pricing
  questions.
- **Data requirement**: directional from day one; a real elasticity estimate needs an actual
  price change and observed churn response to calibrate against (see the
  `raise-basic-membership-price-10-percent` scenario below, deliberately designed as a
  small, reversible experiment rather than a full repricing).

## downtime-cost-simulator

- **Inputs**: `Asset.status = down` windows (from `03-operations/assets-iot.md`),
  `bay-throughput-queue-simulator`'s throughput-by-bay-type, `revenue-per-vehicle`.
- **Method**: lost throughput (vehicles/hour that bay/lane would have served) × average ticket
  value for the time-of-day/day-of-week the downtime occurred (a Saturday-afternoon tunnel
  outage costs far more than a Tuesday-morning one, since it's gated by lost demand, not just
  lost hours).
- **Worked example**: the tunnel conveyor motor down for 3 hours on a Saturday afternoon
  (effective capacity ~14.5 veh/hr, blended revenue-per-vehicle ~$19) ≈ **~$630 in lost
  revenue for that outage alone** - a real number `predictive-maintenance-agent` catching the
  same fault a week earlier (per the bearing-vibration drift trend) is measured against in
  `data-aggregation.md`'s `downtime-cost-with-telemetry-lead-time` analysis.
- **Output**: per-incident and monthly-rollup downtime-cost tiles on the Financial View and
  Operations View.
- **Data requirement**: usable immediately from stated throughput/ticket-value assumptions.

---

## What-if scenarios

| Scenario | Model(s) perturbed | Inputs changed |
|---|---|---|
| `add-a-5th-tunnel-bay` | bay-throughput-queue-simulator, cash-flow-forecast | +1 tunnel slot, +2 wash-technician FTE, equipment financing outflow |
| `raise-basic-membership-price-10-percent` | pricing-scenario-simulator, membership-economics-simulator | `basic-unlimited.monthlyPrice` +10%, elasticity assumption applied to new-signup rate only (existing members grandfathered per the recommended cheap experiment) |
| `three-rainy-days-this-week` | demand-forecast, cash-flow-forecast | weather multiplier applied to the coming 7-day window |
| `tunnel-conveyor-down-2-days` | downtime-cost-simulator, bay-throughput-queue-simulator | tunnel-conveyor-motor Asset forced `down` for 48 operating hours |
| `shift-mix-toward-full-service-upsell-campaign` | membership-economics-simulator, bay-throughput-queue-simulator | package mix shifted +15pp toward `signature-full-service`/`premium-hand-detail`, which increases AOV but consumes more detail-bay capacity (2 bays only) - the simulator is what catches that this trade-off isn't free |

---

## Calibration and honesty

Minimum history before trust: demand forecasting and wash-through-rate distributions need ~8
weeks; bay-throughput, cash-flow, and downtime-cost are usable immediately from stated
assumptions since they're built on physical/contractual facts (cycle times, prices, wage
rates) rather than inferred behavior. Every model output above states its confidence band or
labels its inputs as assumptions rather than presenting a bare point estimate - a founder
deciding whether to add a bay or raise a price needs to know how much to trust the number.
