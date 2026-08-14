# SPEC — the in-thread top-up card (Lounge)

**Status:** DRAFT, not built. **Copy: every string below is placeholder awaiting founder sign-off.**
**Date:** 2026-08-13 · **Repo:** frontend-cursor · **Depends on:** nothing new server-side.

One line: when a user is out of tokens, the Lounge shows an in-thread card with the three
paid plans as tappable chips, each labelled with what it saves, and one tap goes straight
to Stripe.

---

## FILTER

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      Billing surface. It does not touch per-slide transcription or best-per-slide
          ranking, so it is not F1-CORE or F1-SURFACE. It passes as scaffolding only
          because it is the named unblocker of a live defect: today the ONLY out-of-tokens
          surface in the app is a non-clickable sentence (RecordPriceNote.tsx:59-63), and
          the strings written for the blocked case (copy.ts:163-171) are referenced zero
          times. A user who runs dry has no route to pay from where they are.
FENCES:   clear, but three of them are load-bearing here and constrain the design:
          LIVE LOOP  -> in-thread only, NEVER an overlay, never blocks input (§4)
          AC-9       -> price arithmetic only, never performance framing (§6)
          LIVE LOOP  -> every string in §5 needs founder sign-off before merge
LOCKS:    clear (L1/L2/L3 untouched)
REDIRECT: If this is competing for time against open F1 work, it loses. The F1-advancing
          alternatives, in order: (1) word->slide bucketing at the two-clocks boundary,
          (2) transcription fidelity on hard/accented audio, (3) the blended best-slide
          ranking, (4) manual coach load in the F2 shadow loop.
```

One-line PR stamp:
`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear; copy needs sign-off} — locks {clear} — redirect: two-clocks bucketing`

---

## 1. Why in-thread and not a modal

This is not a style preference, it is the fence. `SpeakerSexPrompt.tsx:23-27` and
`speakerSexAskGate.ts:16-22` both record the ruling: the Lounge already layers CoachReview /
Insights / BestPresentation / ideal-text, and **a card that can appear over a running
record→transcribe→coach loop is what the LIVE LOOP fence forbids.**

So the top-up card follows the two existing in-thread precedents exactly —
`LoungeSpeakerSexPrompt` (Lounge.tsx:825) and `ReflectionGamePrompt` — and renders as an
ordinary item inside the thread's scroll container. It scrolls with the conversation, it
cannot cover anything, it steals no focus, and it gates no surface.

`TokenWalletPanel.tsx:16-19` already made the same call for the wallet ("A PANEL, not an
overlay"). This spec does not reverse that. `/dashboard/pricing` stays exactly as it is.

---

## 2. Trigger

The card mounts when **all** of the following hold. Any one false → render nothing.

| # | Condition | Source |
|---|---|---|
| 1 | Token pricing is live | `useTokenWallet().enabled === true` (`useTokenWallet.ts:70`) |
| 2 | The user is actually out | `RecordingBandState.kind === "exhausted"` (`tokens.ts:238`, i.e. `can_record:false`) |
| 3 | There is something to sell them | `currentTier === "free" \|\| currentTier === null` |
| 4 | The BE published paid tiers | `prices.tiers` contains at least one of starter/pro/max |
| 5 | The Lab does not own the screen | `canMountTopUpCard(state, threadLoading)` — §3 |
| 6 | Not snoozed for this period | §7 |

**Condition 2 reuses the signal that already exists.** `exhausted` is the state
`RecordPriceNote` already consumes; this spec adds no new endpoint, no new BE work, and no
second definition of "out of tokens".

**Condition 3 matters.** `TokenPlanCards.tsx:61,107` only offers checkout to free-tier users,
because a second Checkout Session for an existing subscriber creates a **second
subscription** rather than a plan change. A paid user who is out of tokens gets no card —
switching plans needs the billing portal, which is a separate gap (§10).

**Everything fails closed.** A failed prices read means no card, not a broken card.

---

## 3. The mount gate

New file `src/components/willab/topUpCardGate.ts`, a **plain `.ts`** — mirroring
`speakerSexAskGate.ts:5-11`, because vitest here runs with no JSX transform, so a rule kept
inside a `.tsx` cannot be tested at all.

```ts
export function canMountTopUpCard(state: WillabState, threadLoading: boolean): boolean
```

Identical exclusions to `canMountSpeakerSexAsk`:

- `threadLoading` → false (no card above a skeleton)
- `state === "lab_project_pick"` → false (setup, precedes the Lab)
- `isLabOverlay(state)` → false — covers `lab_feelings`, `lab_session_context`,
  `lab_prerecord`, `lab_recording`, `lab_processing`, `readout`, `sendgate_*`

This gate answers **"may we mount at all"** and nothing else. Whether *this user* should be
asked (§2 conditions 1-4, 6) lives in the component, in one place. Two owners for that
question is how the speaker-sex card's four states nearly drifted apart.

---

## 4. Mount point

`Lounge.tsx`, as a sibling of the existing in-thread cards, placed **before**
`LoungeSpeakerSexPrompt` (currently line 825):

```
{threadItems.map(...)}          // the conversation
<LoungeTopUpCard ... />         // NEW — highest priority: it is blocking value
<LoungeSpeakerSexPrompt ... />  // existing
<ReflectionGamePrompt ... />    // existing
```

Ordering rationale: being unable to continue outranks an optional profile question.

**Stacking is allowed and needs no logic** (founder, §11.3). If a user somehow qualifies for
two cards they render as two separate bubbles, in the order above. Do NOT add suppression,
priority or a "one card at a time" rule: the speaker-sex ask fires early in a user's life and
this one only once tokens are exhausted, so the overlap is rare enough not to engineer for.
Each card keeps its own independent gate and neither knows the other exists.

---

## 5. Copy — FOUNDER-SIGNED-OFF 2026-08-13

Seven new keys in `src/components/tokens/copy.ts`, under the existing banner
(`copy.ts:1-24`) which already holds the two rules these obey: *a wallet, not a progress
bar*, and *never explain a price with quality*. House style: no em-dashes.
**Changing any string below needs a new sign-off.**

```ts
topUpTitle:      "You're out of tokens.",
topUpRenews:     (on: string) => `They renew ${on}. Or pick a plan and keep going now.`,
topUpNoDate:     "Pick a plan and keep going now.",
topUpChip:       (tier: string, tokens: string) => `${tier} · ${tokens} tokens`,
topUpChipPrice:  (usd: number) => `$${usd}/mo`,
topUpDismiss:    "Not now",
topUpFailed:     "Couldn't start checkout. Try again.",
```

(`topUpSaving` was in the signed-off set; it is REMOVED with the savings label — §6.)

**Reuse, do not re-add:** the busy label is the existing
`TOKENS_COPY.walletChoosePlanBusy` ("Opening Stripe…", `copy.ts:108`). A ninth string
saying the same thing is how two surfaces drift into two wordings.

Note `topUpRenews` keeps the **wait route** alongside the buy route, for the reason
`RecordPriceNote.tsx:25-27` already gives: with a monthly reset, waiting is a legitimate
choice and hiding it to push an upgrade is a dark pattern.

---

## 6. The savings label — DROPPED (founder ruling 2026-08-13, pricing v3)

This section originally specced a computed per-token savings label ("Save 17%"). **Pricing v3
killed it**: the sold ladder repriced on coach reviews, so per-token, the mid and top tiers
cost *more* than the entry tier and the math renders nothing or lies. Founder ruling: drop the
label entirely for v3 — no savings element, no `planValue.ts`, no percentage anywhere on the
card. Do not resurrect it in any form (per-review framing included) without a new founder
decision.

What survives of this section: **no "most popular" badge** (a claim about other users with no
data behind it, `TokenPlanCards.tsx:24-28`), and the general rule that any number on the card
comes from the served list, never a literal.

---

## 7. Snooze

Dismissal is local-only, exactly like `SNOOZE_KEY` in `SpeakerSexPrompt.tsx:52`:

```ts
const SNOOZE_KEY = "willab.topUp.snoozedPeriod";   // stores period_ends_at
```

**Keyed to the billing period, not a boolean.** Being out of tokens recurs monthly, so a
permanent flag would silence the card forever after one dismissal. Storing `period_ends_at`
means the card returns once a new period has rolled and the user has run dry again. A
`localStorage` throw (private mode) falls through to showing the card — being asked again is
a smaller cost than never being offered at all.

---

## 8. Interaction

One tap. `chip → startPlanCheckout(tier) → window.location.assign(url)` — the existing path
in `subscribe.ts:52-73` and `TokenPlanCards.tsx:63-78`, unchanged. The FE holds no Stripe
secret and no price map; the BE's `POST /v2/tokens/checkout` creates the session.

- Tap → that chip shows `topUpBusy`, all chips disable, no navigation away from the Lounge
  until Stripe's URL is returned.
- `reason: "unavailable"` (Stripe or the price map unconfigured) → hide the chips and render
  nothing further. A server that cannot sell should stop offering.
- `reason: "error"` → `topUpFailed` inline, chips stay live, retry is one tap.
- Return from Stripe lands on `/dashboard/pricing?plan=success` (`subscribe.ts:26-32`), which
  already renders the "being applied" line. **Unchanged by this spec.**

Click count, out of tokens → payment page: **1**, from 3-plus-a-guess today.

---

## 9. Visual

Card shell: reuse `SpeakerSexPrompt.tsx:102-108` verbatim —
`rounded-xl border border-border bg-muted/30 p-4` — so it reads as the same kind of object as
the other in-thread cards, and no new design decision is made.

Chip row: the `SpeakerSexQuestion.tsx:71-101` pattern, which is the one the founder named
("like with sex to choose"): `flex flex-col gap-2 sm:flex-row`, each option
`rounded-lg border px-3 py-2 text-sm`, selected/hover as written there. One chip per paid
tier the BE actually published, **ordered by `usdPerMonth` ascending — never a hardcoded key
list** (pricing v3 renames the keys; a named ladder is the day-one break T5 exists to kill).

Inside a chip: tier name and token count on the first line (`topUpChip`), the price on the
second (`topUpChipPrice`). No savings element (§6). **Palette:** monochrome, orange as
accent only, and at most one orange element — `TokenPlanCards.tsx:30-35` is the standing
rule. Recommend the middle chip carries it, which is emphasis by design rather than a claim.

`"Not now"` as a ghost button, right-aligned, per `SpeakerSexPrompt.tsx:118-129`.

---

## 10. Out of scope, deliberately

1. **Changing or cancelling a plan.** Needs Stripe's billing portal. The BE built
   `POST /v2/tokens/portal` (`token_routes.py:186`) and `plan.managed`
   (`token_routes.py:24-28`); the FE consumes neither — `mapTokenBalance` (`tokens.ts:71-95`)
   does not read `plan`, and there is no `/api/v2/tokens/portal` BFF route. Separate ticket.
2. **The `/dashboard/pricing` blank/plans-less failure.** `TokenWalletScreen.tsx:44` returns
   `null` while probing and renders a plans-less wallet forever if the probe fails. Separate
   ticket. This card is unaffected: it fails closed.
3. **Gating anything on balance.** Recording stays enabled at zero balance, always.
   `charge()` is soft and floors at zero (`token_account.py:502-509`); the record path never
   returns 402. Nothing in this card disables a control.
4. **The dead paywall.** `LabOverlay.tsx:1489-1504` ("Unlock the full audit") fires on a 402
   the BE no longer sends. Delete it separately; this spec does not touch it.
5. **`RecordPriceNote` stays as is.** The card is an addition, not a replacement.

---

## 11. Founder decisions, 2026-08-13

All five resolved. Recorded here so a builder does not re-open them.

1. **Copy — SIGNED OFF** as the literals in §5 (now seven, after the savings removal), plus
   reuse of `walletChoosePlanBusy`. Any change to a string needs a new sign-off.
2. **Saving label — SUPERSEDED.** Originally ruled `"Save 17%"`; the pricing-v3 ruling
   (2026-08-13, later the same day) **drops the label entirely** — see §6. The v3 ruling wins.
3. **Stacking — show both, as separate bubbles.** No suppression logic, no priority ordering
   between the in-thread cards. The founder's reasoning: the speaker-sex ask fires early in a
   user's life and the top-up card fires only once tokens are exhausted, so the overlap is
   rare enough not to engineer around. Each card keeps its own independent gate.
4. **Paid-tier users who run dry — no card, for now.** Confirmed. Sending an existing
   subscriber to Checkout creates a SECOND subscription and double-charges them, so there is
   genuinely nothing safe to offer until the billing portal is wired. Accepted as a known
   revenue hole: a paying user who exhausts their plan mid-period sees only the existing
   renewal line. **Wiring `POST /v2/tokens/portal` + `plan.managed` is the immediate
   follow-up ticket** (§10.1), and it is what closes this.
5. **Free-tier arithmetic — noted, handled elsewhere.** Free is 12,000/month while
   `coach_feedback` charges 35,000 at publish (`token_prices.py:117`, `publish.py:364`), so a
   free user's first coach-published feedback floors them to zero. Soft-charged, nothing
   breaks. Being retuned in a separate pass; **no FE change here, and this card must not
   hardcode any assumption about the free grant.**

---

## 12. Files

**New**
```
src/components/willab/LoungeTopUpCard.tsx     mount rule + card (thin, per LoungeSpeakerSexPrompt)
src/components/willab/topUpCardGate.ts        canMountTopUpCard — pure, testable
src/components/willab/topUpCardGate.test.ts   mirrors speakerSexAskGate.test.ts
src/components/tokens/TokenPlanChips.tsx      the chip row + checkout call
```

**Modified**
```
src/components/willab/Lounge.tsx              one mount, before LoungeSpeakerSexPrompt (~825)
src/components/tokens/copy.ts                 seven signed-off strings (§5)
```

**Not modified:** `TokenPlanCards.tsx`, `TokenWalletPanel.tsx`, `TokenWalletScreen.tsx`,
`RecordPriceNote.tsx`, `subscribe.ts`, `tokens.ts`, every BFF route, and the entire backend.

---

## 13. Tests

Repo convention is pure-predicate and source-grep tests, not component tests — there is no
JSX transform in this vitest config (`speakerSexAskGate.ts:5-11`).

1. `topUpCardGate.test.ts` — false for every `isLabOverlay` state, false for
   `lab_project_pick`, false while `threadLoading`, true for `lounge_idle` /
   `lounge_general` / `insights_ready`.
2. **Fence test** (grep the sources, in the shape of `corpusFence.test.ts:101-103`):
   - no dollar amount, token count, percent **or tier-key** literal in `TokenPlanChips.tsx` or
     `LoungeTopUpCard.tsx` — every number and key comes from the served tier list;
   - neither new component imports an overlay/portal/dialog primitive;
   - both mount points in `Lounge.tsx` sit inside the thread's scroll container, not in the
     overlay stack.
3. `copy.test.ts` — extend the existing house-style assertions to the seven new strings
   (no em-dashes, no performance framing).
