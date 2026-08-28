# Marketing

*Part of the Growth cluster. Compiled from `bir.json`.*

The funnel's whole job here is converting a first-time or pay-per-wash customer into a
membership - that's where the LTV actually is, per `simulation.md`'s membership-economics
model.

---

## Segments

| Segment | Definition |
|---|---|
| New | 0 washes |
| Active Pay-Per-Wash | wash in last 30d, no active membership |
| Active Member | `MembershipSubscription.status = Active` |
| At-Risk Member | 2+ missed expected visits this cycle, or a recent `PastDue` |
| At-Risk Pay-Per-Wash | no wash in 45-90d, previously 3+ visits |
| Lapsed | >90d no wash, no active membership |
| Fleet/Commercial | `Customer.isFleetAccount = true` |

## Funnel

Awareness (social/Google Business Profile/local ads) -> First Wash (walk-in or promo code) ->
Membership Conversion -> Retained Member -> Advocate (referral). Primary channel per stage:
Awareness = social + Google Local Services Ads; First Wash = walk-in/promo; Membership
Conversion = the `new-customer-welcome` drip (below) + kiosk upsell at checkout; Advocate =
referral code.

## Campaigns

| Segment | Channel | Trigger | Offer |
|---|---|---|---|
| New | WhatsApp (post-first-wash) | lifecycle-triggered | `new-customer-welcome` drip -> membership discount |
| Active Pay-Per-Wash | WhatsApp | post-fulfillment | `review-request` (coordinated with the WhatsApp template - not duplicated across channels) |
| At-Risk Member | WhatsApp -> email | lifecycle-triggered | `at-risk-member-winback` drip (pause-instead-of-cancel offer) |
| At-Risk / Lapsed Pay-Per-Wash | WhatsApp | 45d since last wash | `winback-lapsed-customer` automation, discount code |
| Active Member (VIP recognition) | WhatsApp | anniversary/milestone (12-month membership) | Loyalty-point bonus + a free `premium-hand-detail` upgrade credit |
| All | Social/Google Ads | seasonal | Pollen-season and post-storm push (this business's actual seasonality - not a generic spring/holiday assumption) |

## Loyalty

Points-per-dollar for pay-per-wash customers (redeemable for a free package upgrade or a free
wash) - membership itself is the primary retention mechanic for repeat visitors, so loyalty
points stay a lightweight add-on for the pay-per-wash segment rather than a competing program.
See `05-finance/accounting.md` for the `Loyalty Points Payable` liability treatment.

## Referral

`Customer.referralCode` / `referredByCode`: referred customer gets 50% off first wash,
referrer gets a free wash credited on the referred customer's first Completed `WashOrder`.
Cheap to run, high-value for a local service business.

## Lifecycle drip sequences

**`new-customer-welcome`** (trigger: first Completed `WashOrder`)
1. Day 0: thank-you + loyalty-points explainer.
2. Day 3: membership value comparison ("3 washes/month and unlimited already pays for
   itself" - the concrete math from `membership-economics-simulator`, not a vague pitch).
3. Day 10: membership sign-up offer, limited-time discount.

**`at-risk-member-winback`** (trigger: `MembershipSubscription` enters `PastDue`, or 2 missed
expected visits in a cycle)
1. Day 0: gentle WhatsApp check-in.
2. Day 4: escalate to email with a pause-instead-of-cancel offer.
3. Day 8: `phone-line-agent` outbound callback offer if still unresolved.

Both sequences stop immediately if the customer converts, replies with an unrelated request,
or the underlying trigger resolves (payment succeeds, membership reactivates).

## Paid advertising

| ID | Platform | Objective | Segment | Budget |
|---|---|---|---|---|
| `geo-radius-membership-push` | Meta Ads | conversions | New | daily budget, 5-mile geo-fence |
| `google-local-services-ads` | Google Ads (Local Services) | leads | New | pay-per-lead |

## A/B testing

`membership-price-anchor-test`: hypothesis - showing the premium tier first makes the basic
tier feel like the "value" choice, raising basic sign-up rate; variants
`premium-tier-first`/`basic-tier-first`; metric: kiosk membership sign-up conversion rate.
Single sequential test, not a multi-variant split - a single-location business doesn't have
kiosk-signup volume to reach significance on more than one live test at a time.

## Attribution

`attributionModel: last-touch`. Justified here (rather than multi-touch) because the actual
purchase path is short and mostly single-channel - a customer sees a geo-radius ad or a
Google review, drives in, and washes same-day; there usually isn't a multi-week,
multi-channel journey to attribute across. Every campaign/ad/social post carries a
`promoCode`/UTM stored on `WashOrder.promoCode` or `Customer.referredByCode` so "revenue by
channel" on the dashboard is a real computed number, not a platform-reported vanity metric -
see `data-aggregation.md`'s `true-blended-cac` for where this gets combined with actual ad
spend.
