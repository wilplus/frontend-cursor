# BUILD PROMPT — the in-thread top-up card (Lounge)

Paste everything below the line into the coding agent. It is self-contained.

---

## TASK

Repo: **frontend-cursor** (Next.js App Router). Branch: **`claude/pricing-modal-token-tab-br4mp8`**.

Build the **in-thread top-up card**: when a user has run out of tokens, the Lounge shows a
card inside the conversation offering the published paid plans as tappable chips, each
labelled with what it saves, and one tap goes straight to Stripe Checkout.

The full spec is committed at **`docs/SPEC-lounge-topup-card.md`** — read it first, it is the
authority. This prompt is the executable summary. Where they disagree, the spec wins.

Read `CLAUDE.md` before you start and emit the WILLAB DECISION FILTER block. **The verdict is
already settled — do not re-litigate it, just restate it:**

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      Billing surface, not F1. Passes as the named unblocker of a live defect: the only
          out-of-tokens surface today is a non-clickable sentence (RecordPriceNote.tsx:59-63)
          and the strings for the blocked case (copy.ts:163-171) are used zero times.
FENCES:   clear. LIVE LOOP constrains the design (in-thread only, never an overlay).
          Copy is founder-signed-off 2026-08-13 and must be used verbatim.
LOCKS:    clear (L1/L2/L3 untouched)
REDIRECT: n/a
```

---

## THE FIVE RULES THAT ARE NOT NEGOTIABLE

1. **IN-THREAD, NEVER AN OVERLAY.** No modal, dialog, sheet, portal or z-index layer. The card
   renders as an ordinary item inside the Lounge thread's scroll container, exactly like
   `LoungeSpeakerSexPrompt` (`Lounge.tsx:825`) and `ReflectionGamePrompt`. This is the LIVE
   LOOP fence, and the reasoning is already recorded in `SpeakerSexPrompt.tsx:23-27` and
   `speakerSexAskGate.ts:16-22`: a card that can appear over a running
   record→transcribe→coach loop is exactly what that fence exists to stop.
2. **NEVER GATE OR DISABLE ANYTHING.** Recording stays enabled at zero balance, always.
   `charge()` is soft and floors at zero server-side (`token_account.py:502-509`); the record
   path never returns 402. The card is an offer, not a wall. It must not disable a control,
   steal focus, block input, or gate a surface.
3. **NEVER HARDCODE A PRICE, A TOKEN COUNT OR A PERCENTAGE.** Every number comes from the
   BE-served tier list. `tokens.ts:24-28` is explicit: a literal in the FE silently pins a
   number the founder needs to move without a deploy. The savings percentage is *computed*.
4. **USE THE COPY VERBATIM.** The strings in §COPY are founder-signed-off. Do not reword,
   re-punctuate, add, or "improve" them. House style: no em-dashes.
5. **DO NOT TOUCH THE BACKEND.** No BE changes, no new BFF routes, no new endpoints. Every
   signal this needs already exists.

---

## TRIGGER — all six must hold, else render nothing

| # | Condition | Source |
|---|---|---|
| 1 | Pricing is live | `useTokenWallet().enabled === true` (`useTokenWallet.ts:70`) |
| 2 | User is actually out | `RecordingBandState.kind === "exhausted"` (`tokens.ts:238`, i.e. `can_record:false`) |
| 3 | Something to sell them | `currentTier === "free" \|\| currentTier === null` |
| 4 | BE published paid tiers | `prices.tiers` has ≥1 of starter/pro/max |
| 5 | Lab does not own screen | `canMountTopUpCard(state, threadLoading)` |
| 6 | Not snoozed this period | see §SNOOZE |

**Condition 2 reuses the signal that already exists** — `exhausted` is what `RecordPriceNote`
already consumes. Do not invent a second definition of "out of tokens".

**Condition 3 is a safety rule, not a preference.** Sending an existing subscriber to Stripe
Checkout creates a **SECOND subscription** and double-charges them; it is not a plan change.
A real upgrade needs the billing portal, which is out of scope here. So a paid user who runs
dry correctly sees no card. This is a known, accepted gap.

**Everything fails closed.** A failed prices read means no card, never a broken card.

---

## FILES

**New**
```
src/components/willab/topUpCardGate.ts        canMountTopUpCard — pure predicate
src/components/willab/topUpCardGate.test.ts
src/components/willab/LoungeTopUpCard.tsx     the card (thin, per LoungeSpeakerSexPrompt)
src/components/tokens/TokenPlanChips.tsx      chip row + checkout call
src/components/tokens/planValue.ts            savingVsEntryTier — pure
src/components/tokens/planValue.test.ts
```

**Modified — these two files only**
```
src/components/willab/Lounge.tsx              ONE mount line, before LoungeSpeakerSexPrompt (~825)
src/components/tokens/copy.ts                 the eight strings in §COPY
```

**Do NOT modify:** `TokenPlanCards.tsx`, `TokenWalletPanel.tsx`, `TokenWalletScreen.tsx`,
`RecordPriceNote.tsx`, `subscribe.ts`, `tokens.ts`, any BFF route, any backend file.

---

## THE GATE

`src/components/willab/topUpCardGate.ts` must be a **plain `.ts`, not `.tsx`**. vitest here
runs with no JSX transform, so a rule living inside a `.tsx` cannot be tested at all — this is
why `speakerSexAskGate.ts` exists as a sibling of its component (see its header, lines 5-11).

```ts
export function canMountTopUpCard(state: WillabState, threadLoading: boolean): boolean
```

Same exclusions as `canMountSpeakerSexAsk`, and for the same reason:

- `threadLoading` → `false` (no card above a skeleton)
- `state === "lab_project_pick"` → `false` (setup, precedes the Lab)
- `isLabOverlay(state)` → `false` (covers `lab_feelings`, `lab_session_context`,
  `lab_prerecord`, `lab_recording`, `lab_processing`, `readout`, `sendgate_*`)

This answers **"may we mount at all"** and nothing else. Whether *this user* should be shown
the card (trigger conditions 1-4, 6) lives in the component, in one place. Two owners for that
question is how the speaker-sex card's four states nearly drifted apart.

---

## THE SAVINGS MATH

`src/components/tokens/planValue.ts`, pure, no JSX:

```ts
/** Percent cheaper per token than the cheapest PAID tier the BE published.
 *  null for the entry tier itself and for any missing/zero/negative result. */
export function savingVsEntryTier(
  tiers: Record<string, TokenTier>,
  name: string
): number | null
```

- `perThousand = usdPerMonth / (tokensPerMonth / 1000)`
- `saving = Math.round((1 - perThousand / entryPerThousand) * 100)`
- Return `null` if either tier is missing, if any input is `0`, or if `saving <= 0`.
  A label we cannot stand behind is worse than none — the rule `ArcActionPrice` already
  follows.
- The "entry tier" is the cheapest tier present in `tiers` with `usdPerMonth > 0`. Derive it;
  do not assume it is `starter`.

Against today's served list this yields Starter → `null`, Pro → `17`, Max → `33`.
**Assert those in the test but derive them in the code.**

---

## COPY — FOUNDER-SIGNED-OFF, USE VERBATIM

Add to `src/components/tokens/copy.ts` under the existing banner:

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

**Reuse, do not re-add:** the busy label is the existing `TOKENS_COPY.walletChoosePlanBusy`
("Opening Stripe…", `copy.ts:108`). Use `formatTokens` and `formatShortDate` from the same
file; do not format a number or a date locally.

`topUpRenews` keeps the **wait route** next to the buy route on purpose. With a monthly reset,
waiting is a legitimate choice and hiding it to push an upgrade is a dark pattern —
`RecordPriceNote.tsx:25-27` already states this rule.

---

## INTERACTION

One tap, straight to the payment page.

```
chip tap → startPlanCheckout(tier)  [subscribe.ts:52-73, unchanged]
         → window.location.assign(r.url)
```

- While in flight: that chip shows `walletChoosePlanBusy`, all chips disabled, no navigation
  until Stripe returns a URL.
- `r.reason === "unavailable"` (Stripe or the price map unconfigured) → hide the chips
  entirely. A server that cannot sell should stop offering.
- `r.reason === "error"` → render `topUpFailed` inline, leave the chips live so retry is one
  tap.
- Return from Stripe already lands on `/dashboard/pricing?plan=success` and renders the
  "being applied" line (`subscribe.ts:26-32`, `TokenWalletScreen.tsx:37-42`). **Unchanged.**

Copy the buy/error handling shape from `TokenPlanCards.tsx:63-78` rather than reinventing it.

---

## SNOOZE

`"Not now"` dismisses. Local only, like `SpeakerSexPrompt.tsx:52`:

```ts
const SNOOZE_KEY = "willab.topUp.snoozedPeriod";   // stores period_ends_at
```

**Store the period, not a boolean.** Running dry recurs monthly, so a permanent flag would
silence the card forever after one dismissal. Storing `period_ends_at` means it returns once a
new period has rolled and the user is dry again. A `localStorage` throw (private mode) must
fall through to **showing** the card — being offered again is a smaller cost than never being
offered. Initialise the "snoozed" state to `true` so the card cannot flash before
localStorage has been read (same trick as `SpeakerSexPrompt.tsx:66`).

---

## VISUAL

Reuse, so that no new design decision is made:

- **Card shell:** verbatim from `SpeakerSexPrompt.tsx:102-108` —
  `rounded-xl border border-border bg-muted/30 p-4`.
- **Chip row:** the `SpeakerSexQuestion.tsx:71-101` pattern — `flex flex-col gap-2 sm:flex-row`,
  each chip `rounded-lg border px-3 py-2 text-sm`, same hover/selected treatment. These are
  buttons, not radios: one tap acts, there is no selected state to hold.
- **Chip contents:** line 1 `topUpChip(tier, tokens)`, line 2 `topUpChipPrice(usd)` with
  `topUpSaving(pct)` alongside it in `text-muted-foreground`. Omit the saving element entirely
  when `savingVsEntryTier` returns `null`.
- **Order:** starter → pro → max, filtered to tiers the BE actually published.
- **Palette:** monochrome, with **at most ONE orange element** — the standing rule in
  `TokenPlanCards.tsx:30-35`. Put it on the middle chip. Orange comes from `--primary`, never
  a literal.
- **`"Not now"`:** ghost button, right-aligned, per `SpeakerSexPrompt.tsx:118-129`.

**Stacking:** if a user qualifies for both this card and the speaker-sex ask, both render as
separate bubbles. Do **not** add suppression, priority, or a "one card at a time" rule
(founder decision). Each card keeps its own independent gate and neither knows the other
exists.

---

## TESTS

Repo convention is pure-predicate and source-grep tests, **not component tests** — there is no
JSX transform in this vitest config.

1. `topUpCardGate.test.ts` — mirror `speakerSexAskGate.test.ts`. False for every
   `isLabOverlay` state, false for `lab_project_pick`, false while `threadLoading`; true for
   `lounge_idle`, `lounge_general`, `insights_ready`.
2. `planValue.test.ts` — 17 / 33 / `null` against the real served list; `null` for a missing
   tier, `tokensPerMonth: 0`, `usdPerMonth: 0`, and any negative result. Include a case where
   the entry tier is NOT starter, to prove it is derived.
3. **Fence test** (grep the source files, in the shape of `corpusFence.test.ts:101-103`):
   - no `$`, token-count or `%` numeric literal in `TokenPlanChips.tsx` / `LoungeTopUpCard.tsx`;
   - neither imports a dialog/modal/portal/overlay primitive;
   - the new mount in `Lounge.tsx` sits inside the thread's scroll container.
4. Extend `copy.test.ts`'s house-style assertions to the eight new strings (no em-dashes, no
   performance framing).

Run `npm test` and `npx tsc --noEmit`. Both must pass before you commit.

---

## DEFINITION OF DONE

- [ ] Six new files, two modified. Nothing else touched.
- [ ] `npm test` green, `npx tsc --noEmit` clean.
- [ ] No number literal in the new components; every figure traced to the served tier list.
- [ ] Copy byte-identical to §COPY.
- [ ] No overlay, no portal, no disabled control anywhere in the diff.
- [ ] Commit on `claude/pricing-modal-token-tab-br4mp8` with the FILTER stamp in the message.

## DO NOT, IN THIS TICKET

- Wire the billing portal (`POST /v2/tokens/portal`, `plan.managed`). Next ticket.
- Fix `TokenWalletScreen.tsx:44` returning `null` while probing. Separate ticket.
- Delete the dead `LabOverlay.tsx:1489-1504` paywall. Separate ticket.
- Change `RecordPriceNote` — the card is an addition, not a replacement.
- Change any price, tier or grant. Pricing is being retuned elsewhere; hardcode no assumption
  about the free grant.
