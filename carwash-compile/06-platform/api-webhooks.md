# Platform API & Webhooks

*Part of the Platform cluster. Compiled from `bir.json`.*

A light but real API surface - a single-location business doesn't need a franchise-scale
developer portal, but the fleet segment and a future companion mobile app both need
something to integrate against.

---

## API surface

`style: rest` - the safe default; no GraphQL need since integrators want fixed per-entity
access (a fleet partner reading its own orders/invoices), not flexible cross-entity querying.

| Entity | Operations exposed |
|---|---|
| WashOrder | read, create |
| Customer | read, create |
| MembershipSubscription | read |
| Stock | read |

Deliberately not exposed: `Employee`, `JournalEntry`, `Payment` (payment detail stays inside
the Stripe-tokenized boundary, never re-exposed via this API).

## Authentication & scopes

`authMethods: api-key, hmac-signed` - API keys for the fleet partner's server-to-server
integration; HMAC-signed for outbound webhook payloads.

| Scope | Maps to role |
|---|---|
| `orders-readwrite` | `cashier` |
| `fleet-account-readonly` | `fleet-account-manager` |

Each scope is constrained exactly like the human role it mirrors, including the same ABAC
policies from `01-foundation/security.md` - a fleet partner's API key sees only its own
account's `WashOrder`/`Invoice` records, the same boundary a human `fleet-account-manager`
operates within.

## Webhooks (outbound events)

| Event | Source entity | Transition | Payload fields |
|---|---|---|---|
| `wash-order-ready` | WashOrder | QualityCheck -> ReadyForPickup | washOrderId, vehicleId, readyAt |
| `wash-order-completed` | WashOrder | ReadyForPickup -> Completed | washOrderId, completedAt, amount |
| `membership-cancelled` | MembershipSubscription | Suspended -> Cancelled | subscriptionId, customerId, cancelledAt |
| `stock-low` | Stock | quantity crosses below reorderThreshold (field condition, not a lifecycle transition - `Stock` has no state machine of its own) | itemId, warehouseId, quantity |

Every payload is signed (HMAC, per-subscriber secret), retried with exponential backoff on
delivery failure, and replayable by event ID rather than leaving a subscriber to reconstruct
state by polling - the fleet partner's own reordering/scheduling logic can subscribe to
`stock-low` and `wash-order-ready` without needing to poll.

## Rate limits & versioning

`rateLimits`: 300 requests/min per API key, HTTP 429 with `Retry-After` on breach.
`versioningStrategy`: URL-prefixed `/v1/`; breaking changes ship as `/v2/` with `/v1/` kept
live at least 6 months.

## Developer experience

API reference docs generate directly from `exposedEntities` and `webhookEvents` above - a
natural byproduct of the BIR being the source of truth, not a hand-written doc that drifts.
At this scale (1-2 known integration partners: the fleet segment, and eventually a companion
mobile app), a shared doc and manually issued keys are enough - a self-serve developer portal
isn't warranted yet.
