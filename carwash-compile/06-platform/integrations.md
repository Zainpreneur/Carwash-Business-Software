# Integrations Framework ("connect to any platform")

*Part of the Platform cluster. Compiled from `bir.json`.*

Nine integrations, covering payments, accounting, calendar, reviews, messaging, web/ad
analytics, IoT telemetry, weather, and a generic webhook escape hatch.

---

| Integration | Category | Direction | Entities synced | Auth |
|---|---|---|---|---|
| Stripe | payments | bidirectional | Payment, Invoice, MembershipSubscription | oauth2 |
| QuickBooks Online | accounting | outbound | JournalEntry, Invoice | oauth2 |
| Google Calendar | calendar | bidirectional | Shift, WashOrder | oauth2 |
| Google Business Profile | communications | bidirectional | Ticket | oauth2 |
| WhatsApp Cloud API | communications | bidirectional | Customer, WashOrder, MembershipSubscription | api-key |
| Google Analytics / Meta Pixel | analytics | inbound | — | api-key |
| Wash Sensor Platform | iot-telemetry | inbound | Asset | api-key |
| Weather API | analytics | inbound | — | api-key |
| Generic custom webhook | custom-webhook | bidirectional | — | webhook-secret |

## Notes on sync cadence and failure handling (where non-default)

- **Stripe**: real-time webhook for charge success/failure (drives
  `MembershipSubscription`'s `billing-charge-failed` transition directly); conflict resolution
  N/A (Stripe is authoritative for payment state, not edited on both sides).
- **QuickBooks Online**: outbound only, nightly batch - mirrors the native ledger
  (`05-finance/accounting.md`) out for a bookkeeper's convenience rather than QuickBooks being
  the system of record; the native chart of accounts stays authoritative.
- **Wash Sensor Platform**: near-real-time inbound stream, ingested into the analytics store
  every 5 minutes (see `data-aggregation.md`); a sync failure here is treated seriously -
  `predictive-maintenance-agent`'s guardrails depend on fresh telemetry, so a stalled feed
  triggers the same failure-handling pattern as any other integration (exponential backoff,
  dead-letter logging, alert to `site-manager`) rather than the agent silently going quiet.
- **Weather API**: hourly poll, feeds `demand-forecast` (`02-intelligence/simulation.md`);
  most-recent-write-wins is moot here (read-only external data, nothing to conflict).
- **Google Business Profile**: bidirectional (reads reviews/mentions for
  `review-response-agent`, posts responses); failure alerts `site-manager` since unanswered
  reviews are a reputational risk, not just a sync nuisance.
- **Generic custom webhook**: the documented escape hatch for a future or business-specific
  platform (e.g. a POS the business might switch to, or a local aggregator app) - HMAC-signed,
  payload schema keyed to a BIR entity, so nothing needs to be redesigned to wire in a new
  partner later.

All financial-data conflicts (Stripe, QuickBooks) default to most-recent-write-wins per field
with a human-reviewable log - never silently auto-resolved, per the framework's default.
