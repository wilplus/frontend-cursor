# BE handoff — plan management: one route still missing (the billing portal)

**Date:** 2026-07-31 · **Corrected:** 2026-08-01 · **From:** FE (frontend-cursor)
**One remaining ask, at the bottom. Everything above it is the evidence.**

---

## ⚠️ Correction (2026-08-01) — the original version of this doc was wrong

As first written, this handoff asked you to build a subscription checkout. **You had
already built it.** `POST /v2/tokens/checkout` (routes/token_routes.py) has existed since
#301, backed by `services/tier_checkout.py`.

The error was mine and it was methodological: I grepped the backend **working tree**,
which sits on a stale branch, instead of `origin/main`. Acting on that, the FE briefly
shipped a duplicate session-creator with its own copy of `STRIPE_PRICE_TIER_JSON` — the
exact two-copies-of-the-price-map risk this doc warned about. That duplicate is deleted
(FE #215); the FE now calls your route through a thin BFF relay and holds no Stripe
secret, no SDK, and no price map.

Anyone reading this doc for history: verify backend claims against `git grep <ref>
origin/main`, never against the checked-out tree.

## What exists and works, end to end

| piece | where | state |
|---|---|---|
| Create subscription checkout | `POST /v2/tokens/checkout` | ✅ live, FE wired (#215) |
| Grant tier on payment | `stripe_subscription_tiers.apply_subscription_event` | ✅ live |
| Renewals attributable | `subscription_data.metadata.user_id` set by your session | ✅ |
| Unpaid states | `incomplete` / `unpaid` grant nothing | ✅ |
| Cancellation → free | `customer.subscription.deleted`, no claw-back | ✅ |
| Idempotent redelivery | absolute write, grants cannot stack | ✅ |

## Questions the original doc asked that your code already answers

Recorded so nobody re-litigates them. All from `token_account.set_tier` (the webhook's
write path):

1. **Mid-period upgrade timing** — immediate. `set_tier` grants the new allowance and
   re-anchors `period_start` to the Stripe billing date, for the reason its docstring
   gives: billed on the 3rd but re-granted on the 17th makes every support question
   "when do my tokens come back?".
2. **Balance above the new cap on a change** — the write is absolute
   (`token_balance = granted`), so any prior balance is replaced, not carried. Note this
   also means an upgrade discards unspent tokens rather than adding to them; if that is
   ever softened, `set_tier` is the one place to change.
3. **Coach reviews across a tier change** — reset (`coach_reviews_used: 0`) with the new
   period.
4. **Legacy credit balances** — moot. Founder 2026-08-01: there are no real customers,
   so no balance was ever purchased. The FE deleted its last credits surface
   (/admin/credits, FE #210); your `credits` column and the commented-out conversion
   block are dormant data.

## The one ask that remains: the billing portal

There is still no way to **switch or cancel** a plan from inside the app. The FE
deliberately offers checkout only to users on the free tier, because offering it to a
subscriber would create a **second** subscription — Stripe does not treat a new Checkout
Session as a plan change.

The standard answer is a Stripe **billing-portal session** (`stripe.billing_portal.Session.create`),
where Stripe's own hosted page handles switching, cancelling and card changes. Smallest
version the FE could consume:

```jsonc
// POST /v2/tokens/portal        (authed; body empty or {return_url})
// 200
{ "portal_url": "https://billing.stripe.com/p/session/..." }
```

Plus one field so the FE can tell *upgrade* from *manage* without guessing:

```jsonc
// added to GET /v2/tokens/balance
"plan_managed": true   // a live Stripe subscription exists for this user
```

`plan_managed: false` (or absent) → the FE shows the buy buttons, exactly as today.
`true` → it shows "manage your plan" pointing at the portal. Until this exists the wallet
tells subscribed users to email support, which works but does not scale past a handful of
subscribers.

Portal sessions need the customer id — your webhook already sees `sub.customer` on every
subscription event, so persisting it at grant time is probably the whole of the data work.

## Fences, restated for whoever builds the portal route

Unchanged from the original doc and still the contract the FE holds:

- No performance framing anywhere near billing (AC-9): no "you used 80% of your month",
  no streaks, no comparisons.
- Monthly plans, never packs — the allowance resets and the copy must match.
- Never a pre-flight billing check on the record path; takes charge after transcription
  and fail open.
- Coach reviews stay a count with a cap an upgrade may raise but a top-up can never buy
  past.
- Prices stay served; `price_version` is the staleness signal.
