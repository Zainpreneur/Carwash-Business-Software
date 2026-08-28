# Cross-Platform Data Aggregation & Advanced Analysis

*Part of the Intelligence cluster. Compiled from `bir.json` — compiled last in Stage 3, after*
*every integration (`06-platform/integrations.md`) and the platform API*
*(`06-platform/api-webhooks.md`) were settled, since this section depends on knowing both.*

Four of the nine integrations are worth analytics ingestion (the sensor platform, weather,
web/ad analytics, and payment processing fees) - `google-calendar` and
`google-business-profile` feed operational workflows but don't contribute a distinct
analytical dimension beyond what's already native, so they're left out of the table below by
design, not oversight.

---

## External sources

| Integration | Contributes | Joins to dimensions | Freshness |
|---|---|---|---|
| `wash-sensor-platform` | Telemetry trend history and raw signal detail beyond the live read (vibration, current-draw, flow-rate, turbidity, RPM, pressure, temperature series) | Time, Bay | Streamed near-real-time; ingestion-store batch every 5 minutes |
| `weather-api` | Daily precipitation, pollen index | Time | Synced hourly |
| `google-analytics-meta-pixel` | Website/landing-page traffic and ad click-throughs to the membership signup page | Time, Channel | Synced nightly, up to 24h behind native data |
| `stripe` | Processing fees and payout timing | Time, PaymentMethod | Synced nightly |

## Cross-source analyses (the payoff)

### `true-net-membership-margin`
**Sources**: `stripe`, `wash-sensor-platform`.
**Answers**: true net margin per membership tier after processing fees *and* the amortized
chemical/water/labor cost per visit at the plan's actual wash-through rate - not just sticker
MRR. This is the number that actually validates (or contradicts) the
`membership-economics-simulator`'s breakeven-wash-through assumptions in
`02-intelligence/simulation.md` once real data is flowing, rather than leaving that model on
stated assumptions indefinitely.

### `weather-adjusted-demand-accuracy`
**Sources**: `weather-api`.
**Answers**: how much of a slow day is explained by weather vs. an actual demand or marketing
problem - so a rainy Tuesday doesn't get misread by `strategy-advisor`'s root-cause reasoning
as a marketing failure, and a real marketing problem doesn't get written off as "it was just
rain."

### `downtime-cost-with-telemetry-lead-time`
**Sources**: `wash-sensor-platform`.
**Answers**: for each predictive-maintenance catch (`predictive-maintenance-agent`,
`03-operations/assets-iot.md`), how much downtime - and revenue, per the
`downtime-cost-simulator`'s per-incident math - was actually avoided vs. if the same fault had
run to hard failure. This is the number that justifies the sensor investment itself in
dollars, not just operational comfort, and is exactly what `strategy-advisor` would cite if
the owner ever asks "was the IoT sensor platform worth it."

### `true-blended-cac`
**Sources**: `google-analytics-meta-pixel`, `stripe`.
**Answers**: true cost to acquire a paying member across ad spend and processing fees per
signup, vs. the ad platform's own self-reported conversion count - feeds `strategy-advisor`'s
`unit-economics` reasoning pattern directly when marketing-spend questions come up.

*(A true blended-ROAS analysis in the standard sense - ad spend ÷ promo-code-attributed
revenue - isn't listed separately here because `true-blended-cac` already covers this
business's actual marketing question, given `marketing.attributionModel: last-touch` and a
short single-channel purchase path; adding both would double-count the same underlying data
without a second real question behind it.)*

## Data quality and honesty

- Every dashboard/report blending an external source with native real-time data surfaces that
  source's `freshness` explicitly (e.g. the Growth/Marketing View labels `true-blended-cac`
  figures "as of last night" rather than implying same-day accuracy).
- A sync failure on any of the four sources above degrades the affected report gracefully -
  flagged as partial, never silently computed and presented as complete. This reuses
  `05-automations-reminders.md`'s failure-handling pattern and
  `06-platform/integrations.md`'s retry/dead-letter logic rather than inventing separate
  monitoring for analytics ingestion specifically.
- Right-sizing note: with four real analytical sources feeding two membership/marketing
  cross-source analyses and two IoT/weather ones, this business is past the "one or two
  integrations, brief paragraph" case `23-cross-platform-data-aggregation.md` describes - the
  full treatment above is warranted, not inflated for its own sake.
