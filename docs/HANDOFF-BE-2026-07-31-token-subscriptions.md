# BE handoff — the plans are published, priced, and unsellable

**Date:** 2026-07-31 · **From:** FE (frontend-cursor) · **Blocks:** taking money for a plan
**Questions at the bottom. Everything above them is the evidence.**

---

## The situation

Token pricing is live end to end. `TOKEN_PRICING_ENABLED=1`, BE #300/#301/#303 are merged,
and the FE wallet shipped in #198 / #201. A user can now see their balance, their plan, their
renewal date, every published price, and their ledger.

What they cannot do is **change plan**. There is no way to go from free to Starter, Pro or Max,
and no way to leave a paid plan. The four tiers are rendered from `/v2/tokens/prices` with an
honest note saying so, because the alternative was a button that lies.

This is now the only real gap in the feature.

## Why the FE did not just wire it

Three recurring prices exist in Stripe ($5 / $25 / $100, confirmed by the PRICING BE session
against the Stripe API). So the instinct is "the prices are there, point checkout at them".
That does not work, and the reason is in the backend, not in Stripe:

| checked | result |
|---|---|
| `routes/token_routes.py` | **no checkout route at all** |
| `grep -rn 'mode="subscription"' --include=*.py .` | **no hits anywhere** |
| `routes/v2_routes.py:11607` `/arc/<arc_id>/checkout` | `mode: "payment"` — one-time |
| `src/app/api/stripe/checkout/route.ts` (FE BFF) | `mode: "payment"`, credit-pack price ids only |
| `config.py:442` `STRIPE_CHECKOUT_PRICE_CREDITS_JSON` | maps price id → **credits**, not tiers |
| `routes/internal_webhooks.py:157` | credits webhook; grants credits from the packs map |

So the only session-creating code in the product is one-time payment for credit packs, and the
only webhook turns a paid price id into **credits**. Pointing a plan button at that would take a
one-time $25 and grant credits, not a Pro subscription. Pointing it at nothing 404s. Both are
worse than the note.

## What the FE needs

Two endpoints. Shapes are a proposal, not a demand — match whatever fits your code, and the FE
will adapt.

### 1. Start a plan change

```jsonc
// POST /v2/tokens/subscribe   { "tier": "pro" }
// 200
{ "enabled": true, "url": "https://checkout.stripe.com/c/pay/..." }
```

The FE redirects to `url`, exactly as the credit-pack flow already does. It never sees a card
number, and it must not: entering payment details is not something the FE does.

Errors the FE can render, if you want them distinct:

```jsonc
{ "code": "ALREADY_ON_TIER" }      // no-op, tell them calmly
{ "code": "TIER_UNAVAILABLE" }     // tier not purchasable right now
```

### 2. Say what the current plan is and whether it can be changed

`/v2/tokens/balance` already returns `tier`. What it does not say is whether that tier is
**managed** (a live Stripe subscription that can be cancelled or switched) or just the default.
Without that the FE cannot tell "you are on free, upgrade" from "you are on Pro, manage it",
and those need different controls. Smallest version:

```jsonc
// added to GET /v2/tokens/balance
"plan": { "managed": true, "cancel_at_period_end": false,
          "manage_url": "https://billing.stripe.com/p/session/..." }
```

A Stripe billing-portal `manage_url` would let the FE hand off cancellation and card changes
entirely, which is the least code and the least risk on both sides. `managed: false` → the FE
shows upgrade only, which is today's behaviour.

## Decisions that are yours, not the FE's

The FE has no defensible opinion on these, and guessing would put wrong words in front of a
payment:

1. **Mid-period upgrade.** Does the new allowance land immediately, pro-rated, or at the next
   period start? Whatever it is, the FE has to say it *before* checkout, so it needs a sentence
   it can trust.
2. **Downgrade.** Immediate or at period end? And if someone on Max with 1.4M tokens drops to
   Starter (50k), **what happens to the balance above the new cap** — truncated, kept until it
   runs out, or kept forever? This is the one users will be angriest about getting wrong.
3. **Cancellation.** Do they keep the current period they already paid for, and drop to free at
   the end? The FE should show the date they lose it.
4. **Coach reviews on a tier change.** The allowance is a separate counter with its own cap.
   Does the used-count carry across a mid-period change, or reset with the new tier?
5. **The legacy credit balances.** Unrelated to subscriptions but the same class of problem:
   real users hold credits that now buy nothing (the founder's own account has 455). Honoured,
   converted to tokens at some rate, or written off? The FE currently **hides** the credits row
   whenever pricing is on, which is right — a balance that buys nothing should not sit next to
   one that buys everything — but hidden is not resolved, and the money was real.

## What the endpoint must not do

Not style preferences; these are the fences the FE is built to hold, and an endpoint can break
them from underneath:

- **No performance framing anywhere near billing.** No "you used 80% of your month", no
  streaks, no efficiency, no comparison to other users. A number that says how well someone is
  doing rather than what they bought is a score, and that is the AC-9 fence. The monthly reset
  makes this genuinely tempting.
- **Monthly plans, never packs.** The allowance resets, and copy implying a one-time purchase
  makes the first reset feel like theft. Please keep tier language in the payload consistent
  with that.
- **Never gate a recording on billing.** Today takes charge after transcription and fail open,
  and that is correct: a zero balance costs tokens, never the take. A subscription flow must not
  introduce a pre-flight check on the record path.
- **Coach reviews stay a count and stay unpurchasable.** The cap protects the founder's
  calendar. An upgrade may raise it; a top-up must never buy past it.
- **Prices stay served.** The FE hardcodes none, and `price_version` is its staleness signal.

## Questions

1. Will you add a subscription checkout, or is plan change going to live outside the app
   (a Payment Link the founder sends, or the Stripe billing portal)? **If it lives outside the
   app, say so and the FE will keep the honest note permanently rather than leave a gap open.**
2. If you do add it: can `/v2/tokens/balance` carry `plan.managed` and a billing-portal
   `manage_url`? That is the smallest change that lets the FE tell upgrade from manage.
3. What is the answer to the downgrade-above-cap question (decision 2)? That one needs settling
   before any copy can be written, because it is the sentence a user will hold you to.
