# WhatsApp Integration

*Part of the Growth cluster. Compiled from `bir.json`.*

WhatsApp is the primary customer channel here - membership sign-up, wash-status lookup, and
billing lifecycle messaging all run through it, handled conversationally by `wash-concierge`.

---

## Platform setup

- **API tier**: WhatsApp Business Platform Cloud API direct - a single-location business with
  no existing BSP relationship for other channels; the Cloud API is the cost-sensitive,
  simple-setup default.
- **Sender identity**: "SplashPoint Express Wash", category *Automotive*, profile populated
  with hours, address, and the `wash-package-comparison` FAQ link.
- **Number**: a dedicated business number, not a founder's personal line.

## Message templates

| ID | Category | Variables | Trigger |
|---|---|---|---|
| `wash-ready` | UTILITY | customerName, vehiclePlate, bayNumber | `notify-ready-for-pickup` automation |
| `membership-welcome` | UTILITY | customerName, planName, billingDate | `enroll-membership` workflow |
| `payment-failed-update-card` | UTILITY | customerName, planName, updateLink | `membership-payment-failed-dunning` automation |
| `membership-renewing-soon` | UTILITY | customerName, amount, billingDate | `membership-billing-3d-notice` reminder |
| `detail-appointment-reminder` | UTILITY | customerName, appointmentTime, packageName | `detail-appointment-reminder` reminder, -2h |
| `review-request` | UTILITY | customerName, washOrderId | `post-wash-review-request` automation, once, opt-out respected |
| `winback-offer` | MARKETING | customerName, discountCode | `winback-lapsed-customer` automation, marketing-consent gated |

## Conversational flows

| Intent | Workflow invoked | Human handoff condition |
|---|---|---|
| Book/reschedule a detail appointment | `wash-a-vehicle` (bookingType: appointment) | Package/time-slot conflict the agent can't resolve |
| Membership sign-up | `enroll-membership` | Plate lookup conflicts with an existing subscription |
| Wash status lookup ("where's my car") | Read-only `WashOrder` query | Never - always resolvable directly |
| FAQ (hours, pricing, rework/guarantee policy) | `knowledge_base.search` grounded answer | Below 70% confidence, or the question is a policy dispute rather than a lookup |
| Pause/cancel membership | `MembershipSubscription` update | Cancellation itself is allowed autonomously; a *retention* counter-offer beyond the standard pause option escalates to site-manager |
| Damage claim / negative sentiment | Opens a `Ticket` | Always - immediate handoff, never resolved by the agent |

Detail-bay bookings use WhatsApp Flows (a structured time-slot/package picker) rather than
free text, since picking from 2 detail bays' open slots is a form problem, not a conversation.

## Consent & compliance

`whatsapp.consentEntity: Customer.whatsappOptIn` for transactional messaging (implied by using
the service - wash-ready, billing, appointment reminders); `Customer.marketingConsent` is a
**separate** required opt-in for the `winback-offer` MARKETING template, supporting one-tap
"STOP" opt-out. Every outbound template send is logged against the workflow/automation that
triggered it (e.g. `wash-ready` logged against the specific `WashOrder.id`), so a support
question of "why did I get this message" is always traceable. Meta's 24-hour session window
is respected - `wash-concierge` never assumes free-form messaging is available outside an
active customer-initiated session or an approved template send.
