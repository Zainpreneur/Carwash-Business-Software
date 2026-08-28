# Social Media Suite

*Part of the Growth cluster. Compiled from `bir.json`.*

A visual, local B2C business - platform selection leans Instagram/TikTok/Google Business
Profile, not LinkedIn.

---

## Platforms

| Platform | Reason | Cadence |
|---|---|---|
| Instagram | Before/after wash and detail shots - the highest-converting content format for a car wash | 4x/week |
| TikTok | Satisfying tunnel-wash and foam-cannon short-form video has genuine organic reach for this category | 3x/week |
| Google Business Profile | Review generation is disproportionately valuable for a location-based business - most new customers check this before a first visit | Weekly posts + daily review responses |
| Facebook | Local community groups, event/seasonal promo reach for an older demographic than IG/TikTok | 2x/week |

## Content pillars

Before/after transformations · Membership value ("what unlimited actually saves you" -
concrete math, tied to the `membership-economics-simulator`'s breakeven framing) · Behind-the-
scenes tunnel/equipment content (leans into the IoT/predictive-maintenance story as a
trust signal - "here's how we catch problems before your wash is affected") · Seasonal promos
(pollen season, post-storm surge, holiday gift memberships) · Customer/community shoutouts.

## Publishing pipeline

- **Content calendar**: `SocialPost` entity (`platform`, `pillar`, `scheduledFor`, `status`,
  `assetRefs`, `caption`).
- **Generation**: a content-generation capability drafts captions per pillar from templates;
  `site-manager` approves before publish by default. The daily "we're open"/queue-status
  Instagram Story is the one exception made fully autonomous (low-risk, high-cadence,
  factual).
- **Cross-posting**: before/after photo content is safely repurposed IG <-> Facebook;
  TikTok content is shot natively for that platform, not blindly cross-posted.
- **Automation hooks**: a 5-star Google review auto-queues a "customer love"
  `SocialPost` draft for approval (reuses `review-response-agent`'s detection); a new
  membership-tier or seasonal-promo launch triggers a coordinated post draft.

## Listening & engagement

`listeningKeywords`: "SplashPoint", "SplashPoint Express Wash", "splash point car wash",
local competitor names, "car wash near me [local area]". `review-response-agent`
auto-responds to simple positive mentions (thanks, FAQ-style questions); negative mentions or
complaints escalate to `site-manager` immediately, never auto-responded - reputational risk
means autonomy stays conservative here by default, same guardrail as the review-response
agent definition in `ai-agents.md`.

## Analytics

Engagement rate per platform, follower growth, click-through to the membership-signup landing
page (tracked via `google-analytics-meta-pixel`), and social-attributed washes/memberships -
tied back into `WashOrder.promoCode`/`Customer.referredByCode` for attribution, per
`04-growth/marketing.md`'s attribution model.
