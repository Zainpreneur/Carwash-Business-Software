# Advanced CRM: Sales Pipeline & Support

*Part of the Growth cluster. Compiled from `bir.json`.*

No formal sales pipeline - a car wash's core business is instant, walk-in service, exactly the
case `17-crm-sales-support.md` says to skip `pipelineStages`/`dealEntity` for. The support
half applies fully.

---

## Sales pipeline: the lighter path

The one real minority case is the small fleet/commercial segment (local delivery vans, a
rental lot). Rather than a staged `Lead -> Qualified -> Proposal -> Won/Lost` pipeline (which
would be overbuilt for a handful of local business relationships), `crm.leadScoring` alone
covers it: `Customer.fleetLeadScore` incorporates vehicle count requested (3+ = high), a
recurring/scheduled-washing mention, and a net-15 invoicing-terms request. A flagged lead
routes straight to `fleet-account-manager` as a follow-up task via `fleet-lead-scorer`
(`02-intelligence/ai-agents.md`) - no `pipelineStages` or `dealEntity` defined. If the fleet
segment ever grows to where enough revenue moves through a genuine multi-step sales process,
this is the section to recompile first.

## Support / ticketing

`ticketEntity: Ticket`, state machine `Open -> InProgress -> WaitingOnCustomer -> Resolved ->
Closed`.

`supportChannels`: WhatsApp (`wash-concierge` opens a `Ticket` when it can't resolve something
itself, rather than the conversation trailing off), phone (`phone-line-agent`), Google
Business Profile comments (`review-response-agent`'s escalation path), in-app/kiosk.

| Ticket type | First response | Resolution |
|---|---|---|
| damage-claim | 1h during operating hours | 48h |
| billing-dispute | 4h | 72h |
| quality-complaint | 2h during operating hours | 24h |
| membership-question | 1h (usually resolved by `wash-concierge` without a human) | 24h |

SLA-breach risk is a reminder escalating to `site-manager` before the SLA is actually missed,
not after. Negative/urgent tickets (damage claims, billing disputes) route to a human by
default - the same conservative guardrail as social-media negative-mention handling; no agent
auto-closes or auto-resolves a complaint.

## Customer 360

`customer360Includes`: Vehicle list, `WashOrder` history, `MembershipSubscription` status and
wash-through rate, open and past `Ticket` list, `loyaltyPoints` and referral activity,
marketing segment and campaign engagement. This is what a cashier or `wash-concierge` should
see the instant a customer's plate or phone number is looked up - not five separate screens.
Surfaced on the Customer/CRM View (`02-intelligence/views.md`).
