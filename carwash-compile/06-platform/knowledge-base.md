# Knowledge Base & Documents

*Part of the Platform cluster. Compiled from `bir.json`.*

Sized for a single-location business: a handful of customer-facing documents, a short
internal SOP set, and the FAQ library that keeps `wash-concierge`/`phone-line-agent` from
improvising policy.

---

## Document types

| ID | Category | Generated from |
|---|---|---|
| `wash-receipt` | customer-facing | WashOrder, Invoice, Payment |
| `membership-agreement` | customer-facing | MembershipSubscription, MembershipPlan |
| `rework-guarantee-policy` | customer-facing | — (authored) |
| `opening-closing-checklist` | internal | — (authored) |
| `bay-safety-procedure` | internal | Asset |
| `chemical-handling-sds-log` | internal | Supply |
| `faq-hours-pricing-membership` | knowledge-article | — (authored) |
| `damage-claim-policy` | knowledge-article | — (authored) |
| `wash-package-comparison` | knowledge-article | WashPackage, PackagePricing |

## Grounding AI agents

`groundsAgents: wash-concierge, review-response-agent, phone-line-agent` - these three answer
customers directly and must cite the KB rather than free-inventing a policy answer. If
`wash-concierge` is ever caught confidently answering a rework/refund/damage-claim question
that isn't backed by `rework-guarantee-policy` or `damage-claim-policy`, that's treated as a
bug: either the article is missing (write it) or the agent should have escalated instead of
guessing.

## Generation

`wash-receipt` and `membership-agreement` are deterministic template + variable renders
(variables map directly to BIR fields, same pattern as the WhatsApp templates) - not
AI-composed each time. AI generation is reserved for genuinely bespoke content only (e.g. a
fleet-account proposal `fleet-account-manager` tailors per prospect).

## Storage, versioning, e-signature

`sources`: `google-business-profile` (public-facing policy summaries) and a
`generic-custom-webhook`-backed internal wiki (SOPs, safety procedures, SDS logs). Documents
and KB articles version the same way `bir.json` does - bumped on material change, prior
versions retrievable, which matters for `chemical-handling-sds-log` (what a safety data sheet
said on a given date) and `membership-agreement` (what terms a member actually signed up
under). `membership-agreement` uses e-signature at signup rather than a printed/manual
process; the other document types don't require a signature.
