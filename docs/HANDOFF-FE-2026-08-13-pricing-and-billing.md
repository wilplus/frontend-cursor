# HANDOFF — willab pricing & billing surfaces (frontend)

**To:** a coding agent · **From:** an investigation pass, 2026-08-13 · **Repo:** `frontend-cursor`
**Branch:** `claude/pricing-modal-token-tab-br4mp8`

This is a complete, self-contained handoff. Every claim in it was verified by reading source
in both `frontend-cursor` and `backend-cursor`; every file:line is real at the time of writing.
Four tickets, in dependency order. **You can execute them one at a time — each is independent
unless the "Depends on" line says otherwise.**

Read `CLAUDE.md` before touching anything. It contains the WILLAB DECISION FILTER, which you
must run and emit for each ticket. Verdicts are pre-settled below — **restate them, do not
re-litigate them.**

---

# PART 0 — HOW TO USE THIS

1. Pick a ticket. Do not bundle two.
2. Emit the filter block quoted in that ticket.
3. Build exactly what is scoped. Respect the **DO NOT** list — it exists because the other
   three defects are adjacent in the same files and are individually tempting to "just fix".
4. `npm test`, `npx tsc --noEmit`, and `npm run check:bff` must all pass before you commit.
5. Commit on the branch above with the FILTER stamp in the message.

**If anything in this document contradicts what you find in the code, stop and say so.**
The code is the truth; this document is a careful reading of it, not a substitute.

---

# PART 1 — CONTEXT

willab is a voice-coaching product. A user records takes of a presentation; the machine
transcribes them per-slide, ranks them, and assembles the user's best speech. A human coach
reviews. The whole thing is metered in **tokens**.

**The frontend is the surfacing layer.** True F1 (critical path) work lives in the backend.
Almost everything in this handoff is **SCAFFOLDING** by the project's own filter — billing
surfaces do not make transcription or ranking better. They pass only because each one is the
named unblocker of a live, verified defect. If open F1-CORE work exists, that work wins.

## The fences that constrain every ticket here

- **AC-9** — never surface scores, verdicts or performance numbers. **This does not stop
  applying because the surface is billing.** The backend's own `plan_state` docstring says it:
  *"a number that says how well someone is doing rather than what they paid for is a score."*
  Prices, balances and dates are fine. "You've used 80% of your month" is banned.
- **LIVE LOOP** — never break the running record→transcribe→coach→read loop. Concretely:
  **no overlay may appear over a running take**, and **all user-facing copy needs founder
  sign-off**. Copy in this document is signed off 2026-08-13; changing a string needs a new one.
- **Never gate on a balance.** Recording stays enabled at zero tokens, always. `charge()` is
  soft server-side and floors at zero (`backend-cursor/services/token_account.py:502-509`).
  The record path never returns 402 (see T4). Losing someone's take is worse than any billing
  inaccuracy.
- **Never hardcode a price.** `tokens.ts:24-28`: a literal in the FE silently pins a number the
  founder needs to move without a deploy. Every figure comes from `GET /v2/tokens/prices`.

## Repo conventions you must follow

- **No component tests.** vitest here runs with **no JSX transform**, so a test importing a
  `.tsx` cannot even parse. This is why rules live in plain `.ts` files *beside* their
  components (`speakerSexAskGate.ts:5-11` explains it). Put logic in a pure module, test that.
- **Source-grep fence tests** are an established pattern — see `corpusFence.test.ts:101-103`.
- **BFF routes** relay status and body verbatim. `proxy.ts:4-19`: the flag-off body
  `{"enabled": false}` arrives as a **200** on purpose and the FE branches on it, so a route
  that "helpfully" rewrites a status erases the difference between "pricing is off" and "the
  backend is broken". `npm run check:bff` lints for a single idiom.
- **All user-facing token copy lives in one file**, `src/components/tokens/copy.ts`, so
  sign-off is one review. Its header states two rules: *a wallet, not a progress bar*, and
  *never explain a price with quality*. House style: **no em-dashes**.

---

# PART 2 — WHAT I FOUND (the current state)

The founder's report was: *"the pricing does not open when I click on the token tab in the
hamburger menu."* Investigating that turned up four distinct problems.

**The Tokens row is a page link, not a modal, by design.** `AppMenu.tsx:272-281` renders
`<Link href="/dashboard/pricing">`. `TokenWalletPanel.tsx:16-19` is explicit: *"A PANEL, not
an overlay."* So nothing will ever "open" over the Lounge. That part is intended.

**But the page it lands on can render nothing, silently.** → **T1**.

**And there is no out-of-tokens offer anywhere.** The only surface that mentions running dry is
one non-clickable sentence under the record button (`RecordPriceNote.tsx:59-63`). The strings
written for the blocked case (`copy.ts:163-171` — `unlockPrice`, `unlockInsufficient`,
`unlockCoachCap`) are referenced **zero times** in `src/`. → **T2**.

**And a paying customer cannot manage their plan.** The backend has supported it since #301;
the frontend never wired it. → **T3**.

**And one paywall branch is unreachable code.** → **T4**.

---

# PART 3 — PRICING REFERENCE

Single source of truth: `backend-cursor/services/token_prices.py`,
`PRICE_VERSION = "2026-08-01-v2"` (`:31`). Served by `GET /v2/tokens/prices`. **Nothing below is
hardcoded in the frontend and nothing you write may hardcode it either.**

## Plans (`token_prices.py:46-51`)

| Tier | $/mo | Tokens/mo | Coach reviews | $ per 1k | Saving vs Starter |
|---|---|---|---|---|---|
| free | 0 | 12,000 | 0 | — | — |
| starter | 5 | 50,000 | 1 | $0.100 | — |
| pro | 25 | 300,000 | 6 | $0.083 | **17%** |
| max | 100 | 1,500,000 | 30 | $0.067 | **33%** |

The saving column is arithmetic, **not** in the code or any UI today. T2 adds it, computed.

## Action prices (`token_prices.py:80-118`)

| Action | Tokens | | Action | Tokens |
|---|---|---|---|---|
| take_short (<2 min) | 1,000 | | moment_explanation | 2,500 |
| take_medium (2–6 min) | 3,000 | | game | 1,500 |
| take_long (6–15 min) | 6,000 | | insights | 1,000 |
| reread | 1,500 | | chat (per turn) | 150 |
| assembly | 500 | | life_panel | 800 |
| say_it_stronger | 500 | | coach_review | 35,000 |
| piece_retranscribe | 300 | | coach_feedback | 35,000 |

Bands are by duration only, chosen before recording (`:203-207`). Everything resets monthly,
nothing rolls over. `insights` / `game` / `moment_explanation` / `coach_review` are charged
**once per arc** — every re-open is free (`:120-135`).

## Two facts worth knowing, neither of which you should act on

- **Max ships 30 coach reviews, not the 10 in the docs.** The code is right: it is a deliberate
  founder reversal on 2026-08-01, pinned by `test_token_pricing.py:322-330`. Two docs and one
  comment above the table still say 10. Do not "fix" the code to match the docs.
- **The free tier's arithmetic is under review.** Free grants 12,000/month while
  `coach_feedback` charges 35,000 at publish (`token_prices.py:117`,
  `routes/v2/publish.py:364`), so a free user's first coach-published feedback floors them to
  zero. Soft-charged, nothing breaks. **Being retuned separately — hardcode no assumption
  about the free grant.**

---

# PART 4 — THE TICKETS

## T1 — `/dashboard/pricing` renders nothing, silently

**Priority: first.** This is the likely cause of the original bug report, and T2/T3 both make
the same page more important.

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      The wallet page has no loading state and no error state. It renders null while
          probing and a plans-less page forever if the probe fails, so "pricing didn't open"
          is indistinguishable from "pricing is off" and from "the network blipped".
FENCES:   clear. New copy needs sign-off (see below).
LOCKS:    clear
```

### The defect

`TokenWalletScreen.tsx:44`:

```tsx
if (wallet.enabled === null) return null;
```

`enabled` comes from `useTokenWallet.ts:70` — `probed ? prices !== null : null`. And `getJson`
(`tokens.ts:408-425`) funnels **every** failure — 401, network error, malformed JSON — to the
caller's fallback, which for prices is `null`. So:

- **while probing** → the page renders literally nothing (a blank area under the header);
- **if the probe fails** → `enabled === false`, and `TokenWalletPanel.tsx:112` silently omits
  the plan cards:
  ```tsx
  {prices && Object.keys(prices.tiers).length > 0 ? ( …TokenPlanCards… ) : null}
  ```
  The user gets a page titled "Tokens and plans" showing "Balance unavailable right now." and
  a "Show more" link. **No plans, no error, no explanation, no retry.**

**It gets worse:** `tokens.ts:203-208` memoises the *promise* for the page's lifetime:

```ts
let pricesCache: Promise<TokenPrices | null> | null = null;
export function fetchTokenPrices(): Promise<TokenPrices | null> {
  pricesCache ??= getJson("/api/v2/tokens/prices", mapTokenPrices, null);
  return pricesCache;
}
```

One flaky read is cached as `null` until a **hard reload**. Client-side navigation will not
clear it. A user who hits one bad moment is stuck with a plans-less wallet for the session.

### Build

1. **Distinguish the three states.** `useTokenWallet` currently collapses "still probing",
   "pricing is off" and "the read failed" into `enabled: boolean | null`. Widen it so the
   failure is visible — e.g. `pricesState: "probing" | "off" | "failed" | "ready"`. Keep
   `enabled` working for existing callers, or update all of them (there are few:
   `useAppMenuData.ts:137`, `TokenWalletScreen.tsx:33`).
2. **Render a loading state**, not `null`. `LoadingState` already exists
   (`src/components/willab/LoadingState.tsx`) and is what the route-level
   `(protected)/loading.tsx` uses.
3. **Render a failure state with a retry** when the read failed. Retry must **clear the
   memoised promise** — `resetTokenPricesCache()` is already exported (`tokens.ts:211-213`,
   currently marked tests-only; widen the comment).
4. **Leave the genuine "off" state rendering nothing.** That is correct and deliberate.

### Copy — signed off, use verbatim

```ts
walletLoadFailed:  "Couldn't load plans right now.",
walletRetry:       "Try again",
```

### Tests

- A pure state-derivation test for the probe → state mapping (`.ts`, no JSX).
- `resetTokenPricesCache()` genuinely re-fetches after a failure.
- Existing `tokens.test.ts` must stay green — do not change `mapTokenPrices` semantics.

### DO NOT

- Change what `{"enabled": false}` means. Off still renders no wallet UI at all.
- Add a retry that silently loops. One user-initiated retry, no auto-polling.
- Touch T2/T3/T4 territory.

---

## T2 — the in-thread top-up card

**Depends on:** nothing. Independent of T1, but T1 first is better.
**Full spec:** `docs/SPEC-lounge-topup-card.md` · **prompt:** `docs/cursor-prompts/PROMPT-FE-lounge-topup-card.md`

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      The only out-of-tokens surface is a non-clickable sentence
          (RecordPriceNote.tsx:59-63) and the strings for the blocked case
          (copy.ts:163-171) are used zero times. A user who runs dry has no route to pay.
FENCES:   clear. LIVE LOOP constrains the design: in-thread only, never an overlay.
LOCKS:    clear
```

When a user is out of tokens, the Lounge shows a card **inside the conversation** offering the
published paid plans as tappable chips, each labelled with what it saves. One tap → Stripe.

### The five non-negotiables

1. **IN-THREAD, NEVER AN OVERLAY.** No modal, dialog, sheet, portal or z-index layer. It
   renders as an ordinary item in the thread's scroll container, exactly like
   `LoungeSpeakerSexPrompt` (`Lounge.tsx:825`) and `ReflectionGamePrompt`. Reasoning is already
   recorded in `SpeakerSexPrompt.tsx:23-27`.
2. **NEVER GATE OR DISABLE ANYTHING.** It is an offer, not a wall.
3. **NEVER HARDCODE A NUMBER.** The saving is computed from the served tier list.
4. **USE THE COPY VERBATIM.**
5. **NO BACKEND CHANGES.** Every signal already exists.

### Trigger — all six, else render nothing

| # | Condition | Source |
|---|---|---|
| 1 | Pricing live | `useTokenWallet().enabled === true` |
| 2 | Actually out | `RecordingBandState.kind === "exhausted"` (`tokens.ts:238`) |
| 3 | Something to sell | `currentTier === "free" \|\| currentTier === null` |
| 4 | Paid tiers published | `prices.tiers` has ≥1 of starter/pro/max |
| 5 | Lab doesn't own screen | `canMountTopUpCard(state, threadLoading)` |
| 6 | Not snoozed this period | see Snooze |

Condition 2 reuses the signal `RecordPriceNote` already consumes — do not invent a second
definition of "out of tokens". **Condition 3 is a safety rule:** sending an existing subscriber
to Checkout creates a **second subscription** and double-charges them. T3 is what relaxes this.
Everything fails closed.

### The gate

`src/components/willab/topUpCardGate.ts` — **plain `.ts`**, mirroring `speakerSexAskGate.ts`:

```ts
export function canMountTopUpCard(state: WillabState, threadLoading: boolean): boolean
```

False when `threadLoading`, when `state === "lab_project_pick"`, or when `isLabOverlay(state)`.
It answers *"may we mount at all"* and nothing else; conditions 1-4 and 6 live in the component.

### The savings math

`src/components/tokens/planValue.ts`, pure:

```ts
export function savingVsEntryTier(tiers: Record<string, TokenTier>, name: string): number | null
```

`perThousand = usdPerMonth / (tokensPerMonth / 1000)`;
`saving = Math.round((1 - perThousand / entryPerThousand) * 100)`.
Return `null` if either tier is missing, any input is `0`, or `saving <= 0`. The entry tier is
the cheapest tier present with `usdPerMonth > 0` — **derive it, do not assume `starter`**.
Today: starter → `null`, pro → `17`, max → `33`. Assert those; derive them.

### Copy — signed off, verbatim

```ts
topUpTitle:      "You're out of tokens.",
topUpRenews:     (on: string) => `They renew ${on}. Or pick a plan and keep going now.`,
topUpNoDate:     "Pick a plan and keep going now.",
topUpChip:       (tier: string, tokens: string) => `${tier} · ${tokens} tokens`,
topUpChipPrice:  (usd: number) => `$${usd}/mo`,
topUpSaving:     (pct: number) => `Save ${pct}%`,
topUpDismiss:    "Not now",
topUpFailed:     "Couldn't start checkout. Try again.",
```

Reuse `walletChoosePlanBusy` ("Opening Stripe…", `copy.ts:108`) for the busy label — do not add
a ninth string saying the same thing. Use `formatTokens` / `formatShortDate` from the same file.

`topUpRenews` keeps the **wait route** beside the buy route deliberately: with a monthly reset,
waiting is legitimate and hiding it is a dark pattern (`RecordPriceNote.tsx:25-27`).

### Interaction, snooze, visual

- `chip tap → startPlanCheckout(tier) → window.location.assign(r.url)`. Copy the error handling
  shape from `TokenPlanCards.tsx:63-78`. `reason: "unavailable"` → hide the chips entirely.
- Snooze on "Not now": `localStorage` key `willab.topUp.snoozedPeriod` storing
  **`period_ends_at`, not a boolean** — running dry recurs monthly, so a permanent flag would
  silence the card forever. A `localStorage` throw falls through to **showing** the card.
  Initialise "snoozed" to `true` so it cannot flash before storage is read
  (`SpeakerSexPrompt.tsx:66`).
- Card shell verbatim from `SpeakerSexPrompt.tsx:102-108`; chip row from
  `SpeakerSexQuestion.tsx:71-101` (buttons, not radios — one tap acts). Order starter → pro →
  max. Monochrome with **at most one orange element** (`TokenPlanCards.tsx:30-35`) on the middle
  chip, from `--primary`, never a literal. "Not now" as a ghost button
  (`SpeakerSexPrompt.tsx:118-129`).
- **Stacking is allowed and needs no logic** (founder decision). If a user qualifies for both
  this and the speaker-sex ask, both render as separate bubbles. Do **not** add suppression or
  priority — the sex ask fires early in a user's life, this only once tokens run out.

### Files

New: `topUpCardGate.ts` + test, `LoungeTopUpCard.tsx`, `TokenPlanChips.tsx`, `planValue.ts` +
test. Modified: `Lounge.tsx` (**one mount line**, before `LoungeSpeakerSexPrompt` ~825),
`copy.ts` (eight strings).
Do **not** modify `TokenPlanCards.tsx`, `TokenWalletPanel.tsx`, `RecordPriceNote.tsx`,
`subscribe.ts`, `tokens.ts`, any BFF route, or the backend.

---

## T3 — wire the billing portal

**Depends on:** nothing. **Full prompt:** `docs/cursor-prompts/PROMPT-FE-billing-portal.md`

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      The BE published POST /v2/tokens/portal and the `plan` object on the balance read;
          the FE consumes neither. Subscribers have no in-app route to cancel, switch, or fix
          a declined card, and are told to email support.
FENCES:   clear. AC-9 applies to billing: dates and what-was-bought only.
LOCKS:    clear
```

**Frontend only. The backend needs no changes.**

### The contract — verified against source

`GET /v2/tokens/balance` carries a `plan` object (`token_account.py:890-923`):

```jsonc
"plan": {
  "tier": "pro",
  "managed": true,                        // a LIVE subscription exists
  "status": "active",                     // active | trialing | past_due | canceled | null
  "cancel_at_period_end": false,
  "current_period_end": "2026-09-13T…Z",
  "manage_available": true                // the portal can open something
}
```

**⚠️ `managed` and `manage_available` are two different fields. Conflating them is the trap.**

- `managed` — live subscription right now? Decides **buy vs. manage**.
  `MANAGED_STATUSES = {active, trialing, past_due}` (`token_account.py:831`).
- `manage_available` — does a Stripe **customer** exist? Decides whether the portal button
  renders. It tracks the customer, which **outlives the subscription** — someone who cancelled
  months ago is still `true` and can reach their invoices.

| `managed` | `manage_available` | Render |
|---|---|---|
| false | false | Buy buttons only (today's free-user behaviour, unchanged) |
| false | true | Buy buttons **and** the manage link (cancelled: resubscribe + past invoices) |
| true | true | **Manage only. NO buy buttons.** |
| true | false | Manage only, no buttons at all; falls back to the email-support line. Unmigrated DB only. |

**`past_due` counts as `managed: true` deliberately** — the card failed, the subscription
exists, the portal is where it gets fixed. `token_account.py:834-836`: offering "upgrade" there
would *sell them a second subscription to solve a billing problem*.

`POST /v2/tokens/portal` → `200 {portal_url}` · `404 {code:"NO_SUBSCRIPTION"}` (**not an error
to show** — render upgrade instead) · `503 DISABLED` · `502 STRIPE_API_ERROR` · `400
INVALID_INPUT`.

**Mint on the click, never on render.** Sessions expire, and a Stripe call inside the balance
read would make a Stripe outage look like a missing balance. The backend enforces this with a
test that greps its own source (`test_stripe_not_our_product.py:401-410`). Never cache or
prefetch a portal URL. **Always send `return_url`** — the BE default is `{FRONTEND_URL}/account`
and this app has no `/account` route. Use `${origin}/dashboard/pricing?plan=managed`.

**Neither endpoint is gated on `TOKEN_PRICING_ENABLED`** — that flag governs whether actions are
*charged* and must never be why someone cannot cancel.

### Also fix: two 409s the FE swallows

`POST /v2/tokens/checkout` returns (`token_routes.py:160-165`):

- `409 ALREADY_ON_TIER` — already on it. Say so calmly, do nothing.
- `409 MANAGE_EXISTING` — they have a **different** live subscription; route to the portal.
  Buying through checkout would leave them **paying for two plans at once**.

`subscribe.ts:66-72` handles only `DISABLED` and `MISCONFIGURED`, so both surface as "Couldn't
start checkout. Try again." Fix in this ticket.

### Build

1. **`tokens.ts`** — add `TokenPlan` and `plan: TokenPlan | null` to the `kind: "ready"` branch
   of `TokenBalance`. `null` when absent or malformed; an older backend must not crash the
   wallet. Reuse the existing `num` / `str` helpers; never invent a value.
2. **`src/components/tokens/planControls.ts`** — pure, no JSX:
   ```ts
   export function planControlsFor(plan: TokenPlan | null, currentTier: string | null): {
     canBuy: boolean; canManage: boolean; endsOn: string | null;
   }
   ```
   `plan === null` → **fall back to today's behaviour exactly**: `canBuy = (currentTier ===
   "free" || currentTier === null)`, `canManage = false`. `TokenPlanCards.tsx:48-52` explains
   why unknown is treated as NOT free — preserve it. Otherwise `canBuy = !plan.managed`,
   `canManage = plan.manageAvailable`, `endsOn = plan.cancelAtPeriodEnd ?
   plan.currentPeriodEnd : null` (a lapsed sub is not "cancelling", it has already gone —
   `token_account.py:911-913`).
3. **`subscribe.ts`** — add `startBillingPortal()` mirroring `startPlanCheckout`'s shape
   (`:44-80`). Result union includes `{ ok: false; reason: "none" }` for the 404, which renders
   **nothing at all**. Extend `startPlanCheckout` for the two 409s.
4. **`src/app/api/v2/tokens/portal/route.ts`** — copy `checkout/route.ts` verbatim, changing
   only the upstream path. Relay status and body untouched. `proxy.ts` is GET-only, so this is
   a POST sibling of `checkout/route.ts`, not a change to `proxy.ts`. Run `npm run check:bff`.
5. **`TokenPlanCards.tsx`** — replace the local `onFree` heuristic (`:61`) with
   `planControlsFor(...)`. `canManage` → a "Manage plan" button calling `startBillingPortal()`;
   busy shows `walletChoosePlanBusy`; `reason: "none"` hides it. `endsOn` → render the ends-on
   line above the cards. Neither → keep the existing `walletManageUnavailable`
   (`copy.ts:117-118`) as the terminal fallback rather than the default.

### Copy — signed off, verbatim

```ts
planManageCta:      "Manage plan",
planEndsOn:         (on: string) => `Your plan ends ${on}.`,
planManageFailed:   "Couldn't open billing. Try again.",
planAlreadyOnTier:  "You're already on that plan.",
planManageExisting: "You already have a plan. Use Manage plan to switch.",
walletPlanManaged:  "Any changes are being applied.",
```

The last one goes in `TokenWalletScreen.tsx` beside `walletPlanSuccess` / `walletPlanCancelled`
(`:60-66`), for the `?plan=managed` return.

### Tests

- `planControls.test.ts` — one case per matrix row, plus: `plan === null` reproduces legacy
  behaviour; `past_due` + `managed: true` → `canBuy === false`; cancelled → **both** `canBuy`
  and `canManage` true; `cancel_at_period_end: false` → `endsOn === null` even when
  `current_period_end` is set.
- **`src/services/api/tokens.test.ts` already exists** and already has a
  `describe("mapTokenBalance")` block from line 55. **Extend it — do not create a new file or
  rewrite existing cases.**
- Fence test mirroring the backend's: grep `tokens.ts`, assert no portal URL is read from the
  balance payload.

### Deploy prerequisite — verify, do not assume

Both flags read columns from `migrations/add_subscription_state.sql` (manifest line 269,
`0231`). If it has not run on your environment, `plan_state` catches the error and returns
**both flags false** (`test_token_pricing.py:1247-1257`) — everything degrades to upgrade-only
and the button never appears. That is the correct failure mode, but it looks exactly like
broken frontend code. Confirm the migration ran before debugging the FE.

---

## T4 — delete the unreachable upload paywall

**Small. Do it last.** Depends on nothing.

```
VERDICT:  DEFER (do it opportunistically; it is dead-code removal, not a fix)
CATEGORY: SCAFFOLDING
WHY:      Removes a branch that cannot execute. No behaviour change ⇒ no priority (R2).
```

`LabOverlay.tsx:1489-1504` renders an "Unlock the full audit" paywall linking to
`/dashboard/pricing`, gated on `uploadPaywall`, set at `LabOverlay.tsx:578` from
`result.status === 402` on the recording upload. `labRecording.ts:311-322` maps that 402.

**The recording upload endpoint cannot return 402.** `backend-cursor/routes/v2/lab_recording.py:713-717`:

> *"Founder re-lock 2026-07-06: recording/analysis/send are NEVER payment-gated — every take of
> every arc records, analyzes, and reaches the coach free. (The old take-3 402 here aborted
> unpaid takes before they persisted — the 'coach only received take 1' bug.)"*

A grep for `402` in that file returns only that comment. The branch is unreachable.

Remove the `uploadPaywall` state, its setter, the `paywall` prop, and the branch. **Keep** the
402 mapping in `labRecording.ts` or delete it — your call, but if you delete it, say so in the
commit, because a future BE change could reintroduce the status.

### ⚠️ Do NOT generalise this — other 402s are live

`routes/v2/arcs.py` still returns real 402s:

- `:678` — `402 {code: "INSUFFICIENT_TOKENS", required, current, reason}` on
  `POST /explore/arc/<arc_id>/unlock-moments` (charges `moment_explanation`, 2,500 tokens).
- `:719` — `402 {code: "MOMENTS_LOCKED", price_credits}` on the per-moment read.

**Open question, not a task:** no frontend code references `unlock-moments`,
`INSUFFICIENT_TOKENS` or `MOMENTS_LOCKED`, and the three unused `unlock*` strings in
`copy.ts:163-171` look like they were written for exactly this. Either the moments-unlock UI was
removed and those endpoints are orphaned, or it is a real gap. **Do not build it on a guess —
raise it with the founder.**

---

# PART 5 — ORDER, AND THE TRAPS

## Suggested order

**T1 → T3 → T2 → T4.** T1 first because it may be the original bug and both other tickets make
that page matter more. T3 before T2 because T3 is what eventually relaxes T2's "paid users get
no card" rule — though **T2 must still ship with that rule**; relaxing it is a separate,
founder-approved change.

They are independent, so a different order is fine. Just do not bundle them.

## Facts an agent will get wrong

1. **`managed` ≠ `manage_available`.** (T3.) Both exist, both are real, they mean different
   things.
2. **`past_due` means manage, not upgrade.** Showing upgrade sells a second subscription.
3. **`{"enabled": false}` is a 200, not a 404**, and the FE branches on the body. Never rewrite
   a status in a BFF route.
4. **There are no component tests here**, and there cannot be — no JSX transform. Put logic in
   pure `.ts` and test that.
5. **`src/services/api/tokens.test.ts` exists.** Extend it; do not create it.
6. **The record path never 402s, but other endpoints do.** (T4.) Do not delete 402 handling
   globally.
7. **Max really does grant 30 coach reviews.** The docs saying 10 are stale. Do not "fix" it.
8. **`/dashboard/pricing` is a page, not a modal**, deliberately. Do not convert it to an
   overlay, and do not add an overlay anywhere near the Lounge — LIVE LOOP.
9. **Copy is founder-owned.** Every string in this document is signed off as written. Inventing
   or "improving" one is a fence breach, however small (R13).

## Definition of done, all tickets

- [ ] `npm test` green · `npx tsc --noEmit` clean · `npm run check:bff` passing
- [ ] No price, token count or percentage literal in any new component
- [ ] Copy byte-identical to this document
- [ ] No overlay, no portal, no disabled control introduced anywhere
- [ ] A free user's experience unchanged unless the ticket explicitly changes it
- [ ] An older/misconfigured backend degrades to today's behaviour, never a crash
- [ ] Committed on `claude/pricing-modal-token-tab-br4mp8` with the FILTER stamp
