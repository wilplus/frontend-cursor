# BUILD PROMPT — wire the billing portal (manage / switch / cancel a plan)

Paste everything below the line into the coding agent. It is self-contained.

---

## TASK

Repo: **frontend-cursor** (Next.js App Router). Branch: **`claude/pricing-modal-token-tab-br4mp8`**.

The backend has supported managing a subscription since #301. **The frontend has never wired
it.** Today a paying user who wants to switch, cancel, or fix a failed card is told to email
support (`copy.ts:117-118`), and a subscriber who taps a plan card gets a generic "Couldn't
start checkout. Try again."

Wire it. **Frontend only — the backend needs no changes whatsoever.**

Read `CLAUDE.md` first and emit the WILLAB DECISION FILTER block. The verdict is settled:

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      Billing surface, not F1. Passes as the named unblocker of a live defect: the BE
          published POST /v2/tokens/portal and the `plan` object on the balance read, and the
          FE consumes neither — mapTokenBalance (tokens.ts:71-95) never reads `plan` and there
          is no /api/v2/tokens/portal BFF route. Subscribers currently have no in-app route to
          cancel, switch, or fix a declined card.
FENCES:   clear. AC-9 applies to billing too: dates and what-was-bought only, never how much
          of an allowance was used or how that compares to anything.
          Copy needs founder sign-off; the five strings in §COPY are signed off 2026-08-13.
LOCKS:    clear (L1/L2/L3 untouched)
REDIRECT: n/a
```

---

## THE BACKEND CONTRACT — verified against source, do not re-derive it

### `GET /v2/tokens/balance` carries a `plan` object

Produced by `plan_state()` (`services/token_account.py:890-923`):

```jsonc
"plan": {
  "tier": "pro",                          // normalised; unknown degrades to "free"
  "managed": true,                        // a LIVE subscription exists
  "status": "active",                     // active | trialing | past_due | canceled | null
  "cancel_at_period_end": false,          // only meaningful while managed
  "current_period_end": "2026-09-13T…Z",  // the date they LOSE the tier when cancelling
  "manage_available": true                // the portal can open something for them
}
```

### ⚠️ `managed` and `manage_available` are TWO DIFFERENT FIELDS. Conflating them is the main trap.

- **`managed`** — is there a live subscription right now? Decides **buy vs. manage**.
  `MANAGED_STATUSES = {active, trialing, past_due}` (`token_account.py:831`).
- **`manage_available`** — does a Stripe *customer* exist? Decides **whether to render the
  portal button at all**. It tracks the customer, which **outlives the subscription**, so
  somebody who cancelled months ago is still `manage_available: true` and can reach their
  invoices.

**The decision matrix — implement exactly this:**

| `managed` | `manage_available` | Render |
|---|---|---|
| `false` | `false` | Buy buttons only. Today's free-user behaviour, unchanged. |
| `false` | `true` | Buy buttons **and** the manage link. Cancelled/lapsed: they can resubscribe *and* still reach past invoices. |
| `true` | `true` | **Manage only. NO buy buttons.** |
| `true` | `false` | Manage only, no buy buttons, and no manage button either (nothing to open). Falls back to the email-support line. Only reachable on an unmigrated DB. |

**`past_due` counts as `managed: true`, deliberately.** The card failed, the subscription
exists, and the portal is where it gets fixed. `token_account.py:834-836` is explicit:
offering "upgrade" there would *sell them a second subscription to solve a billing problem*.

### `POST /v2/tokens/portal` — mints the URL on the click

```jsonc
// body: {"return_url"?: string}
200 { "portal_url": "https://billing.stripe.com/p/session/…" }
404 { "code": "NO_SUBSCRIPTION" }   // NOT an error to show. Render upgrade instead.
503 { "code": "DISABLED" }          // no STRIPE_SECRET_KEY
502 { "code": "STRIPE_API_ERROR" }
400 { "code": "INVALID_INPUT" }
```

**Mint on the click, never on render.** Portal sessions expire, and putting a Stripe call
inside the balance read would make a Stripe outage look like a missing balance. The backend
enforces this with a test that greps its own source
(`test_stripe_not_our_product.py:401-410`). Do not cache a portal URL, and do not prefetch one.

**Always send `return_url`.** The BE default is `{FRONTEND_URL}/account`, and **this app has no
`/account` route** — same reason `subscribe.ts:26-32` always sends its own URLs.
Use `${origin}/dashboard/pricing?plan=managed`.

Neither endpoint is gated on `TOKEN_PRICING_ENABLED` — that flag governs whether actions are
*charged*, and it must never be the reason someone cannot cancel.

### `POST /v2/tokens/checkout` returns two 409s the FE currently swallows

`token_routes.py:160-165`:

- `409 ALREADY_ON_TIER` — they are already on it. Say so calmly, do nothing.
- `409 MANAGE_EXISTING` — they have a **different** live subscription. Route them to the
  portal. Buying through checkout would leave them **paying for two plans at once**.

`subscribe.ts:66-72` handles only `DISABLED` and `MISCONFIGURED`, so both of these currently
surface as "Couldn't start checkout. Try again." Fix that in this ticket.

---

## FILES

**New**
```
src/app/api/v2/tokens/portal/route.ts     BFF relay, POST
src/components/tokens/planControls.ts     pure decision logic
src/components/tokens/planControls.test.ts
```

**Modified**
```
src/services/api/tokens.ts       map `plan` in mapTokenBalance; export TokenPlan
src/services/api/subscribe.ts    startBillingPortal(); handle the two 409 codes
src/components/tokens/TokenPlanCards.tsx   buy vs manage from planControls
src/components/tokens/copy.ts    the five strings in §COPY
```

**Do NOT modify:** anything in `backend-cursor`, `RecordPriceNote.tsx`, `Lounge.tsx`,
`useTokenWallet.ts`, `AppMenu.tsx`, or any other BFF route.

---

## IMPLEMENTATION

### 1. `tokens.ts` — map the plan, degrade safely

```ts
export interface TokenPlan {
  tier: string | null;
  managed: boolean;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  manageAvailable: boolean;
}
```

Add `plan: TokenPlan | null` to the `kind: "ready"` branch of `TokenBalance`. **`null` when the
key is absent or malformed** — an older backend must not crash the wallet.

Follow the file's existing discipline: reuse the `num` / `str` helpers, treat a missing
boolean as `false`, and **never invent a value**. `tokens.ts:10-29` states the three rules this
module exists to enforce; the second one (`available:false` means UNKNOWN, never zero) is the
spirit to copy here.

### 2. `planControls.ts` — the decision, as a pure function

A plain `.ts`, no JSX. vitest here runs with **no JSX transform**, which is why this repo has
no component tests and why rules live beside components rather than inside them
(`speakerSexAskGate.ts:5-11`).

```ts
export interface PlanControls {
  canBuy: boolean;        // render the tier CTAs
  canManage: boolean;     // render the "Manage plan" button
  endsOn: string | null;  // ISO date, only when cancel_at_period_end is set
}
export function planControlsFor(plan: TokenPlan | null, currentTier: string | null): PlanControls
```

- `plan === null` → **fall back to today's behaviour exactly**: `canBuy = (currentTier ===
  "free" || currentTier === null)`, `canManage = false`. The existing comment at
  `TokenPlanCards.tsx:48-52` explains why unknown is treated as NOT free — nobody who *might*
  already be subscribed is offered a second subscription. Preserve that.
- `plan !== null` → `canBuy = !plan.managed`, `canManage = plan.manageAvailable`.
- `endsOn = plan.cancelAtPeriodEnd ? plan.currentPeriodEnd : null`. A lapsed subscription is
  not "cancelling", it has already gone — `token_account.py:911-913`.

### 3. `subscribe.ts` — add the portal, extend the result union

```ts
export type StartPortalResult =
  | { ok: true; url: string }
  | { ok: false; reason: "none" }        // 404 NO_SUBSCRIPTION — render upgrade, show nothing
  | { ok: false; reason: "unavailable"; message: string }   // 503 DISABLED
  | { ok: false; reason: "error"; message: string };

export async function startBillingPortal(): Promise<StartPortalResult>
```

Mirror `startPlanCheckout`'s shape (`subscribe.ts:44-80`) — same auth guard, same
`fetch`-in-try, same JSON-parse-with-catch. `reason: "none"` renders **nothing at all**: a 404
is "there is nothing to manage", not a failure to show anybody.

Extend `startPlanCheckout` for the two 409s: `ALREADY_ON_TIER` → `planAlreadyOnTier`,
`MANAGE_EXISTING` → `planManageExisting` (§COPY).

### 4. `portal/route.ts` — BFF relay

Copy `src/app/api/v2/tokens/checkout/route.ts` structure verbatim, changing only the upstream
path to `/v2/tokens/portal`. **Relay the status and body untouched** — the FE branches on
`code`, so a route that "helpfully" rewrote a status would erase the difference between
"nothing to manage" and "Stripe is down". `proxy.ts:4-19` is the standing rule; that helper is
GET-only, so this route is a POST sibling of `checkout/route.ts`, not a change to `proxy.ts`.

Run **`npm run check:bff`** — this repo lints for a single BFF idiom and the new route must
satisfy it.

### 5. `TokenPlanCards.tsx` — buy vs manage

Replace the local `onFree` heuristic (`:61`) with `planControlsFor(...)`. Then:

- `canBuy` → the tier CTAs, exactly as today. No change to the buy path.
- `canManage` → a **"Manage plan"** button. On click: `startBillingPortal()` → on `ok`,
  `window.location.assign(url)`; while in flight show `walletChoosePlanBusy` and disable;
  on `reason: "none"` hide the button; on `unavailable`/`error` show the message inline.
- `endsOn` → render `planEndsOn(formatShortDate(endsOn))` above the cards.
- Neither `canBuy` nor `canManage` → keep the existing `walletManageUnavailable` line
  (`copy.ts:117-118`) as the terminal fallback. It stops being the *default* and becomes the
  genuine last resort, which is the point of this ticket.

---

## COPY — FOUNDER-SIGNED-OFF 2026-08-13, USE VERBATIM

Add to `src/components/tokens/copy.ts`. House style: **no em-dashes.**

```ts
planManageCta:        "Manage plan",
planEndsOn:           (on: string) => `Your plan ends ${on}.`,
planManageFailed:     "Couldn't open billing. Try again.",
planAlreadyOnTier:    "You're already on that plan.",
planManageExisting:   "You already have a plan. Use Manage plan to switch.",
```

Plus one for the Stripe return (`?plan=managed`) in `TokenWalletScreen.tsx`, alongside the
existing `walletPlanSuccess` / `walletPlanCancelled` at `:60-66`:

```ts
walletPlanManaged:    "Any changes are being applied.",
```

**Reuse, do not re-add:** the busy label is `walletChoosePlanBusy` ("Opening Stripe…",
`copy.ts:108`). Dates go through `formatShortDate`; never format one locally.

**AC-9 applies here.** `plan_state`'s own docstring says it: *"a number that says how well
someone is doing rather than what they paid for is a score, and AC-9 does not stop applying
because the surface is billing."* Dates and what-was-bought only. No "you've used X% of your
month", no streaks, no comparisons, no renewal countdown framed as urgency.

---

## TESTS

Pure-predicate and source-grep only; there is no JSX transform in this vitest config.

1. **`planControls.test.ts`** — one case per row of the decision matrix, plus:
   - `plan === null` reproduces the legacy behaviour for `"free"` / `null` / `"pro"`;
   - `status: "past_due"` with `managed: true` → `canBuy === false` (the double-charge guard);
   - cancelled (`managed: false`, `manage_available: true`) → **both** `canBuy` and
     `canManage` true;
   - `cancel_at_period_end: false` → `endsOn === null` even when `current_period_end` is set.
2. **`src/services/api/tokens.test.ts`** — **this file already exists** and already has a
   `describe("mapTokenBalance")` block (from line 55). **Extend that block, do not create a
   new file and do not rewrite the existing cases.** Add: `plan` absent → `null`; a
   partial/malformed `plan` → `null` or safe defaults, never a throw; the full object → every
   field mapped. Match the style of the cases already there.
3. **Fence test**, mirroring the BE's own (`test_stripe_not_our_product.py:401-410`): grep
   `tokens.ts` and assert it contains no `portal` URL read — the balance carries a boolean, the
   URL is minted on the click.
4. **`copy.test.ts`** (extend) — the six new strings against the existing house-style
   assertions (no em-dashes, no performance framing).

`npm test`, `npx tsc --noEmit`, and `npm run check:bff` must all pass before you commit.

---

## DEFINITION OF DONE

- [ ] A subscriber sees "Manage plan" and reaches Stripe's portal in one click.
- [ ] A subscriber is **never** offered a tier CTA that would create a second subscription.
- [ ] A `past_due` user is routed to manage, not upgrade.
- [ ] A cancelled user sees both buy buttons and a route to their invoices.
- [ ] A free user's experience is **byte-identical to today**.
- [ ] An older BE with no `plan` key degrades to exactly today's behaviour, no crash.
- [ ] `npm test` green, `npx tsc --noEmit` clean, `npm run check:bff` passing.
- [ ] Commit on `claude/pricing-modal-token-tab-br4mp8` with the FILTER stamp.

## DO NOT, IN THIS TICKET

- Touch the backend. Everything needed is already live.
- Build the in-thread top-up card (`docs/cursor-prompts/PROMPT-FE-lounge-topup-card.md`).
  If both land, that card's "paid users get no card" rule is what this ticket eventually
  relaxes — but **not here**, and not without the founder.
- Fix `TokenWalletScreen.tsx:44` returning `null` while probing. Separate ticket.
- Delete the dead `LabOverlay.tsx:1489-1504` paywall. Separate ticket.
- Cache, prefetch, or store a portal URL anywhere.
- Add any usage, percentage, streak or comparison framing to the plan UI.

## DEPLOY PREREQUISITE — verify, do not assume

`plan.managed` and `plan.manage_available` both read columns added by
`migrations/add_subscription_state.sql` (manifest line 269, `0231`). If that migration has not
run against the environment you are testing on, `plan_state` catches the error and returns
**both flags false** (`test_token_pricing.py:1247-1257`), so everything silently degrades to
upgrade-only and the portal button never appears. That is the correct failure mode, but it will
look like your code is broken. Confirm the migration has run before debugging the frontend.
