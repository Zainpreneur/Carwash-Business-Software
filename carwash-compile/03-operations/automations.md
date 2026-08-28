# Actions, Automations & Reminders

*Part of the Operations cluster. Compiled from `bir.json`.*

Eleven automations plus six reminder rules. Deterministic "always do X when Y" rules only -
anything requiring judgment (bay dispatch balancing, billing dunning tone, telemetry drift
detection) is an agent in `02-intelligence/ai-agents.md`, not an automation here.

---

## Automations

| ID | Trigger | Condition | Action | Owner |
|---|---|---|---|---|
| `notify-ready-for-pickup` | `WashOrder: QualityCheck -> ReadyForPickup` | `customer.whatsappOptIn == true` | send-whatsapp `wash-ready` | `wash-concierge` |
| `queue-wait-alert` | queue length recalculated | `queueLength > 8 \|\| predictedWaitMinutes > 20` | notify-role(site-manager) | `queue-dispatch-agent` |
| `bay-down-reroute` | `Asset.status -> down` | — | invoke-agent(`queue-dispatch-agent`, rebalance-queue-excluding-bay) | `site-manager` |
| `membership-payment-failed-dunning` | `MembershipSubscription: Active -> PastDue` | — | send-whatsapp `payment-failed-update-card`, escalation [whatsapp → email → phone-line-agent callback] | `membership-billing-agent` |
| `membership-renewal-price-lock-reminder` | `Subscription.nextBillingDate` | `daysUntilBilling == 3` | send-whatsapp `membership-renewing-soon` | `membership-billing-agent` |
| `low-supply-reorder` | `Stock.quantity` crosses below `reorderThreshold` | — | invoke-agent(`inventory-forecaster`) | `inventory-forecaster` |
| `maintenance-overdue-escalation` | `MaintenanceOrder` unchanged past scheduled date | `status in [Requested,PartsPending,Scheduled] && scheduledDate < today` | notify-role(site-manager) | `site-manager` |
| `shift-no-show-alert` | `Shift.startTime` passed, still `scheduled` | `now > startTime + 10min` | notify-role(site-manager) | `site-manager` |
| `fleet-invoice-overdue` | `Invoice: Sent -> Overdue` | `customer.isFleetAccount == true` | notify-role(fleet-account-manager) | `fleet-account-manager` |
| `post-wash-review-request` | `WashOrder: ReadyForPickup -> Completed` | `whatsappOptIn && paymentMethod != membership && no other message sent today` | send-whatsapp `review-request`, +2h delay | `wash-concierge` |
| `winback-lapsed-customer` | 45 days since last Completed WashOrder | `marketingConsent == true && isFleetAccount == false` | invoke-agent(`wash-concierge`, send-winback-offer) | `wash-concierge` |
| `damage-claim-immediate-escalation` | `Ticket` created, `category = damage-claim` | — | notify-role(site-manager, urgency: immediate) | `site-manager` |

---

## Reminders

| ID | Entity | Offset | Channel | Escalation |
|---|---|---|---|---|
| `membership-billing-3d-notice` | MembershipSubscription | -3d | whatsapp | — |
| `detail-appointment-reminder` | WashOrder | -2h | whatsapp | whatsapp → sms |
| `post-wash-review-request-reminder` | WashOrder | +2h | whatsapp | — |
| `asset-preventive-maintenance-due` | Asset | RRULE:FREQ=MONTHLY | call-agent | call-agent → notify-role(site-manager) |
| `past-due-payment-followup` | MembershipSubscription | +3d | whatsapp | whatsapp → email → call-agent |
| `fleet-lead-followup` | Customer | +1d | call-agent | — |

Quiet hours: no outbound customer message (reminder or automation) fires outside 8am-8pm local
time by default, queued to the next window if triggered outside it.

---

## Anti-spam / stacking check

Traced one realistic event - a `WashOrder` reaching `ReadyForPickup` for an opted-in,
non-member, marketing-consented customer - through every rule that could fire on it:

1. `notify-ready-for-pickup` fires immediately (transactional, always sends).
2. `post-wash-review-request` fires +2h later, *after* checkout (`ReadyForPickup -> Completed`)
   - a **different** transition than #1, so it can't double-fire off the same event, and its
   condition explicitly requires "no other message sent to this customer today" as a second
   guard.
3. `winback-lapsed-customer` cannot fire the same day - it requires 45 days since the *last*
   Completed WashOrder, which this visit just reset.

Result: **at most 2 messages** for one visit (ready notification + a same-day review request
2 hours later, never both within the same hour) - both content-distinct and neither
redundant. `membership-payment-failed-dunning` and `winback-lapsed-customer` are mutually
exclusive by construction (a member in the billing-failure flow is, by definition, not in the
45-day-lapsed pay-per-wash segment). Re-verified after every section compiled in this pass per
`22-qa-and-completeness.md` - see `07-delivery/qa-report.md`.
