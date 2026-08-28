# Assets, Equipment & IoT / Predictive Maintenance

*Part of the Operations cluster. Compiled from `bir.json`.*

This is the section the business specifically asked for. A car wash's economics are unusually
sensitive to equipment uptime - unlike most service businesses, a single asset failure
(the tunnel conveyor motor) doesn't just slow one job, it takes the *entire* express-wash
lane offline simultaneously. That's what justifies real IoT investment here rather than
manual-inspection-only.

---

## Asset registry

`assetEntity: Asset`. Seven asset types, each tied to a `ServiceBay`:

| Asset type | Where | Why it matters |
|---|---|---|
| `tunnel-conveyor-motor` | Bays 1-4 (the tunnel line) | Single point of failure for the entire express lane - see downtime-cost note below |
| `foam-applicator-arch` | Tunnel | Wash-quality driver - a clogged nozzle produces a visibly streaky wash, the #1 driver of `quality-complaint` tickets |
| `water-reclaim-ro-system` | Central plant | Feeds every bay; also the compliance-relevant asset (wastewater discharge quality, see `security.md`) |
| `air-compressor` | Central plant | Drives dryer blowers and pneumatic tools tunnel-wide |
| `water-heater-boiler` | Central plant | Hot-water wash quality (cold-water washes visibly underperform, especially in winter) |
| `dryer-blower-bank` | End of tunnel | Final-step wash quality; a weak dryer is a common source of "still wet" complaints |
| `vacuum-station` | Detail bays / self-serve area | Lower downtime cost (customer-facing self-serve, not gating the tunnel), so scheduled maintenance only, no telemetry |

`status` enum: `operational` / `degraded` / `down` / `retired`. `degraded` is a real
intermediate state used deliberately - it's what `predictive-maintenance-agent` sets when
telemetry drifts out of range *before* the asset actually fails, distinct from waiting for a
hard `down`.

## Preventive maintenance

| Asset type | Cadence | Task |
|---|---|---|
| tunnel-conveyor-motor | monthly | lubricate bearings, inspect chain tension |
| tunnel-conveyor-motor | annually | replace drive belt |
| foam-applicator-arch | weekly | clear nozzle clogs, check chemical mix ratio |
| water-reclaim-ro-system | monthly | replace reclaim filter media, check turbidity output |
| air-compressor | monthly | drain moisture trap, check belt tension |
| water-heater-boiler | quarterly | descale, inspect pressure relief valve |
| dryer-blower-bank | monthly | clean intake filters, inspect blower bearings |
| vacuum-station | weekly | empty canister, check motor filter |

Each schedule reuses the `reminderRule` pattern against `Asset` (`asset-preventive-
maintenance-due`, `03-operations/automations.md`) rather than a separate scheduling
mechanism, escalating to `site-manager` if a scheduled service goes overdue.

## IoT telemetry

Sensors are on the five highest-downtime-cost, highest-failure-consequence assets only -
`vacuum-station`s run on the fixed weekly schedule alone; the payback on instrumenting a
customer-facing self-serve vacuum doesn't clear the sensor cost the way the tunnel-line assets
do.

| Asset type | Signals | Integration | Why these signals |
|---|---|---|---|
| tunnel-conveyor-motor | vibration, current-draw, runtime-hours | `wash-sensor-platform` | Vibration trend catches bearing wear weeks before failure; current-draw spike catches motor overload/jam in real time |
| water-reclaim-ro-system | flow-rate, turbidity, filter-pressure-differential | `wash-sensor-platform` | Rising pressure differential across the filter = clogging before output quality degrades; turbidity is also the compliance-relevant reading |
| air-compressor | pressure, current-draw, runtime-hours | `wash-sensor-platform` | Pressure decay under load = a developing leak or worn valve |
| water-heater-boiler | temperature, pressure | `wash-sensor-platform` | Safety-relevant (pressure relief) as well as wash-quality-relevant |
| dryer-blower-bank | rpm, temperature, vibration | `wash-sensor-platform` | RPM drop under normal load = worn bearing or belt slip; temperature catches motor overheating |

## Predictive maintenance (the AI-native part)

`predictiveMaintenance: true`. The `predictive-maintenance-agent`
(`02-intelligence/ai-agents.md`) watches each signal against that specific asset's *learned*
normal operating range - not a single fixed threshold - because the two failure signatures
that matter here look completely different in the data:

- **Slow drift** (e.g. tunnel motor vibration climbing 3-4% per week over a month as a
  bearing wears): the agent trends this against the asset's own rolling baseline and opens a
  `MaintenanceOrder` while the asset is still `degraded`, well before a hard failure - this is
  the scenario that actually avoids the ~$630/outage figure modeled in
  `02-intelligence/simulation.md`'s downtime-cost-simulator, since the fix happens on a
  planned schedule instead of an unplanned Saturday-afternoon breakdown.
- **Sudden spike** (e.g. air-compressor current-draw jumping instantly, or boiler pressure
  exceeding a hard safety limit): treated as an immediate `down`/unsafe condition, not a
  trend to watch - the agent takes the asset offline itself in this case (see guardrail
  below) rather than waiting for a drift pattern that isn't the failure mode in play.

**MaintenanceOrder** (`assetId`, `triggeredBy`: `scheduled`/`predictive` with the triggering
signal noted, `technicianId`, `partsUsed`, `estimatedDowntimeCost`), state machine `Requested
-> PartsPending -> Scheduled -> InProgress -> Completed`. A `predictive` order pulls the
needed part from `Stock` if on hand; if short, it auto-generates a `PurchaseOrder` to the
`parts-supplier-equipment` (10-day lead time, per `03-operations/inventory.md` - which is
exactly why catching drift early, not at hard failure, matters for parts logistics too).

**Guardrail** (unchanged from `04-ai-agents.md`): the agent can create/schedule a
`MaintenanceOrder` and request parts autonomously; taking equipment offline **during business
hours requires `site-manager` confirmation**, unless the asset has already failed or is
unsafe to keep running (boiler over-pressure, a motor current-draw spike consistent with an
imminent jam) - in which case it acts immediately and notifies `site-manager` after the fact,
because waiting for a human confirmation on an already-unsafe asset is the wrong tradeoff.

## Downtime cost

An `Asset` going `down` is computed against the revenue/capacity it represents, not just
logged as an outage:

- **Tunnel-line assets** (conveyor motor, foam arch, boiler, air compressor, dryer blower):
  any one of these going down effectively takes the *entire* 4-bay tunnel offline (it's one
  conveyor line, not 4 independent bays) - full express-lane capacity loss.
- **Detail-bay/vacuum assets**: downtime only affects that one bay/station, not the whole
  site.

This feeds `13-analytics-and-reporting.md`'s anomaly rules directly (an Asset's
telemetry-flagged anomaly count doubling week-over-week) and the
`downtime-cost-simulator`/`tunnel-conveyor-down-2-days` scenario in
`02-intelligence/simulation.md`, so "how much did that breakdown actually cost us" is a real
computed dollar figure on the Financial View, not a shrug - and, once 8+ weeks of predictive
catches accumulate, feeds `data-aggregation.md`'s `downtime-cost-with-telemetry-lead-time`
cross-source analysis: how much of that cost was actually *avoided* by catching drift early
instead of running to failure, which is the number that justifies the sensor investment
itself in dollars rather than just operational comfort.
