# Coach review flow — implementation handover

**For:** the coding agent implementing / extending this flow.
**Companion prompt:** `AGENT_PROMPT.md` beside this file. Read it first.
**Founder:** artur@willonski.com — the only person who can resolve an ambiguity
this document does not answer.

**Status.** The flow described here is **already implemented and merged**
(frontend PR #388, squashed as `2e062e4`). `main` has since advanced well past
that commit — at the time of writing to `b699709` — so **read the files on
current `main`, never the PR diff**. The wiring below was re-verified against
`b699709` and is intact.

Three companion documents, all normative:

| File | What it is |
|---|---|
| `SPEC.md` | The founder-specified design. Every fork was decided explicitly. |
| `prototype.html` | A walkable single-file prototype. Open in a browser, no build. |
| this file | The flows, the design contract, the interaction rules, the shipped code, and the open items. |

Where `SPEC.md` and this file disagree, `SPEC.md` wins on **intent** and this
file wins on **what the code currently does**. If they disagree at all, that is
a defect — report it rather than choosing.

---

## 1 — The flow

One door per student. Judgement first, the machine's guesses after, delivery
last and once per arc.

```
Your students                       StudentRosterOverlay        unchanged
  └─ student                        StudentDetailOverlay        ONE door: "Review <topic>"
      └─ Judgement, take 1          CoachReviewOverlay (blind)  one piece per screen
          └─ Judgement, take 2      same screen, next session    same screen, next take
              └─ Feedbacks review   CoachStarVerdictOverlay      opens only when every take is judged
                  └─ Wrap up        CoachDeliveryOverlay         one action: "Open the ideal text"
                      └─ Ideal text BestPresentationOverlay      one action: approve
                          └─ Message to the user                 arc-level, one message
                              └─ Review and send                 one action: "Publish the full analysis"
                                  └─ Delivered                   auto-closes → student, take reads Done
```

Two detours leave the path and return:

- a take row on the Feedbacks review opens that take's **contextual** pass;
- **Build an exercise** hands off to the CMS (see Open item 1 — the return leg
  is not built).

The wrap-up's quiet footer link **"Skip it and send what you have"** jumps
straight to *Review and send*. That skip is the point: **the ideal text is an
optional step, never a gate.** Verified on both sides — the FE blocker parser
accepts only `NO_TAKES` (`coachReviewState.pickBlocker`), and the backend's
`v2_coach_publish_analysis` → `publish_complete_reviews` never reads the
approval at all. `IDEAL_TEXT_NOT_APPROVED` is an **advisory**, asserted as a
non-blocker by `test_eager_ideal_text.py`. Do not reintroduce a gate.

### Screen-by-screen

| # | Screen | Component | The one action |
|---|---|---|---|
| 1 | Your students | `StudentRosterOverlay` | open a student |
| 2 | Student | `StudentDetailOverlay` | `Review <topic>` → `judge.start(arcId, sessionIds)` |
| 3 | Judgement (per take) | `CoachReviewOverlay` + `CoachJudgementQueue` | answer one blind question per piece |
| 4 | Feedbacks review | `CoachStarVerdictOverlay` | `Wrap up` |
| 5 | Wrap up | `CoachDeliveryOverlay` (`screen="wrapup"`) | `Open the ideal text` |
| 6 | Ideal text | `BestPresentationOverlay` → `CoachIdealTextPanel` | approve |
| 7 | Message to the user | `CoachDeliveryOverlay` (`"message"`) | `Review and send` |
| 8 | Review and send | `CoachDeliveryOverlay` (`"send"`) | `Publish the full analysis` |
| 9 | Delivered | `CoachDeliveryOverlay` (`"delivered"`) | none — auto-closes after 1500 ms |

---

## 2 — Architecture: overlays, not routes

Every screen above is an **overlay mounted on the always-mounted Lounge**
(`/chat`), not a route. They all carry `z-40`, so **DOM mount order decides
paint order** — later in the DOM paints on top.

The order in `Lounge.tsx` is load-bearing and must not be changed casually:

```
StudentRosterOverlay
StudentDetailOverlay          ~1708   keyed `${studentDetail.id}:${detailNonce}`
ReviewGroupOverlay
CoachStarVerdictOverlay       ~1745   ← opens the review, so must mount BEFORE it
CoachDeliveryMount            ~1764
CoachReviewOverlay            ~1787   keyed by `reviewSessionId`
BestPresentationOverlay               ← opens over everything, so mounts last
```

**Why this exact order.** The star panel's per-take rows *open* the review. While
the star panel was mounted last, the review opened **underneath it** — the coach
saw nothing happen and had to dismiss the panel with the ✕ to reach what they had
just opened. That was the original bug. Moving the star block above the review
block is the fix. If you reorder these mounts, you reintroduce it.

**Two keys are load-bearing:**

- `key={reviewSessionId}` on `CoachReviewOverlay` — walking take 1 → take 2 swaps
  the id in place; without a remount the queue keeps take 1's cursor and opens
  take 2 *past its own last piece*, with no forward control at all.
- `key={`${studentDetail.id}:${detailNonce}`}` on `StudentDetailOverlay` —
  `detailNonce` bumps after a delivery so the detail refetches and the take reads
  `Done`.

---

## 3 — The shipped code

### New files

| File | Lines | Role |
|---|---|---|
| `src/components/willab/CoachDeliveryOverlay.tsx` | 393 | Arc-level delivery: wrap up → message → review and send → delivered. |
| `src/components/willab/CoachJudgementQueue.tsx` | 169 | The chrome **every** blind pass wears. Chrome only — imports neither lane. |
| `src/components/willab/useJudgeWalk.ts` | 80 | The take-by-take walk. Lives outside the Lounge (complexity ratchet + N1). |
| `src/lib/willab/flushCoachReviewDrafts.ts` | 50 | Auto-save: flushes localStorage drafts to the server on leaving. |

### Modified files

- `src/components/willab/Lounge.tsx` — overlay order, `useJudgeWalk` wiring, both
  `onOpenStarVerdicts` call sites, module-level `parseReviewPiece()` and
  `CoachDeliveryMount()`.
- `src/components/willab/CoachReviewOverlay.tsx` — props reduced to
  `{ sessionId, onClose, initialPiece, completeLabel, onQueueComplete }`;
  `onPublished`/`onOpenArcIdeal` removed (delivery is no longer its job).
- `src/components/willab/CoachSnippetReviewCard.tsx` — `renderBlindPiece()`
  extracted to module level; `onBuildExercise?` added.
- `src/components/willab/CoachStarVerdictOverlay.tsx` — publish section removed;
  footer is `Back` / `Wrap up`; blind pass paged via `cvAt`/`onCvAt`.
- `src/components/willab/SnippetScreenShell.tsx` — `isCoachMessage` →
  `hasSlideBehind` (default `true`); the scrim only renders with a slide behind.
- `src/components/willab/blindLabelingIsBlind.test.ts` — the fence follows the
  markup into `renderBlindPiece`. **It was not relaxed.**
- `e2e/corpus.spec.mjs` — mirrors `CONFIDENCE_QUESTION`.

### The three contracts you will most likely touch

**`useJudgeWalk`** — holds no lane vocabulary, so the review lane and the star
lane still import nothing from each other (**N1**).

```ts
export function useJudgeWalk(handlers: {
  onOpenTake: (sessionId: string) => void;
  onComplete: (arcId: string, sessionIds: string[]) => void;
}): {
  walk: JudgeWalk | null;
  start: (arcId: string, sessionIds: string[]) => void;
  stop: () => void;
  /** "Judge take N" | "On to the feedback" | undefined */
  completeLabel: string | undefined;
  /** undefined when no walk runs → the queue's last action simply closes */
  onQueueComplete: (() => void) | undefined;
};
```

`completeLabel`/`onQueueComplete` are `undefined` **on purpose** when no walk is
running: a single deep-linked review (`/chat?review=<id>`) should just close, not
pretend to advance.

**`CoachJudgementQueue`** — chrome only. No direction labels, no star families,
no verdicts.

```ts
export interface JudgementQueueItem { id: string; answered: boolean; }

<CoachJudgementQueue
  title eyebrow items index savingId
  onJump onBack onClose
  forward={{ label, onClick, tone?: "primary" | "quiet", disabled?, busy? }}
>{children}</CoachJudgementQueue>
```

**`flushCoachReviewDrafts(sessionIds): Promise<string[]>`** — returns the ids
that failed. Best-effort and quiet: a failure leaves the draft on disk so the
next flush retries. An **empty** save is meaningful — "reviewed, nothing to
surface" is a valid verdict and the backend stamps `coach_feedback_saved_at` on
it by design.

---

## 4 — Interaction rules

These are behaviour, not polish. Each one was decided explicitly.

1. **Auto-advance on answer — except Yes and No.** `onBlindRatingCommitted`
   advances the cursor after **420 ms**. A `"yes"` or `"no"` returns early
   without advancing, because those two reveal the words and the exercise link;
   advancing past them would hide both. There, `Next` becomes a tap.
2. **Mark answered locally, not on the refetch.** The blind rating saves through
   its own lane, so the session read is a round trip behind — long enough for the
   dot to stay hollow and the forward button to still read `Skip` on a piece the
   coach has just answered. Hence the local `judged` map, set on commit.
3. **Forward-button states.** Not last piece → `Next` (primary) if answered, else
   `Skip` (quiet). Last piece, all answered → `completeLabel ?? "Done"`
   (primary). Last piece, **not** all answered → **no forward control at all**.
4. **Save is automatic.** The explicit "Save feedback" button is gone. Leaving
   the Feedbacks review for the wrap-up is what commits the take:
   `handleWrapUp` → `flushCoachReviewDrafts(...)` → `onWrapUp(arcId)`. Notes /
   tags / surfaced flags stay local until that one commit — a half-written note
   must never reach the student. Blind ratings are untouched; they have always
   saved immediately through their own lane.
5. **Returning from the ideal text.** While `screen === "wrapup"`,
   `CoachDeliveryOverlay` polls `refresh()` every **2500 ms**; if the coach
   approved the ideal text while they were there, it carries them on to
   `message` rather than dropping them back on a screen whose one action they
   have already taken.
6. **One message per arc.** It rides on the **earliest** take
   (`primaryTake()` sorts by `takeIndex`), not duplicated onto every bubble.
7. **`snippets: []` is safe.** `CoachDeliveryOverlay.saveMessage()` sends an
   empty array. Confirmed against the backend's `save-feedback`:
   `if isinstance(_inline, list) and _inline:` — an empty array writes **no**
   snippets, so it cannot wipe the coach's work.
8. **Publish marks the whole arc done.** `onPublished(sessionIds)` →
   `sessionIds.forEach(markDone)` + `detailNonce++`. Marking only one take would
   land the coach on a student that reads Done for take 1 and pending for take 2.
9. **Delivered auto-closes** after **1500 ms**, and is click/Enter/Space
   dismissible. It is a confirmation, not a destination.
10. **Deep link round trip.** `Build an exercise` →
    `/cms/new/exercise/1?returnTo=<encoded /chat?review=<id>&piece=<n>>`. The
    piece is `cursor + 1` (1-based). On return, `Lounge` parses `?piece=` via
    `parseReviewPiece()` → `initialPiece`, and the queue reopens where the coach
    left it. Drafts survive the trip in localStorage already. **See Open item 1.**

---

## 5 — Design contract

Tailwind, shadcn-style semantic tokens only. **Never** a raw hex or a
`dark:` variant — the tokens already carry both themes.

### Tokens in use

`bg-background` · `text-foreground` · `bg-foreground` / `text-background` (the
black action) · `border-border` · `text-muted-foreground` · `bg-primary` /
`border-primary` · `text-success` · `ring-foreground`.

### Buttons — one idiom

| Role | Class |
|---|---|
| Full-width black action (`Action`) | `h-14 w-full rounded-full bg-foreground text-[16px] font-semibold text-background` |
| Centred CTA (wrap-up) | `h-11 min-w-[220px] rounded-full bg-foreground px-6 text-[15px] font-semibold text-background` |
| Queue forward, primary | `h-11 flex-1 rounded-full bg-foreground text-[15px] font-semibold text-background` |
| Queue forward, quiet | `h-11 flex-1 rounded-full border border-border text-[15px] font-normal text-foreground` |
| Queue back | `h-11 flex-1 rounded-full border border-border text-[15px] text-foreground disabled:opacity-40` |
| Quiet skip link | `text-[12px] text-muted-foreground underline underline-offset-2` |

Founder rulings, verbatim in intent: **"in all instances not just here all big
black btn"** and **"make the button central and small size like every other CTA
in the app"**. One button idiom. No button-inside-a-button.

### Progress dots

- Hit target `h-6 w-6`, dot `h-2.5 w-2.5`, both `rounded-full`.
- Saving → `animate-pulse border-amber-500 bg-amber-400`.
- Answered → `border-primary bg-primary`.
- Unanswered → `border-muted-foreground/50 bg-transparent`.
- Current → `ring-2 ring-foreground ring-offset-1 ring-offset-background` on the
  **hit target**, not the dot.
- Count line: `{answered} / {items.length} labelled`, or `All labelled` with
  `CheckCircle2` once every piece is answered.

### Layout

- Overlay root: `fixed inset-0 z-40 flex flex-col bg-background`.
- Header: `border-b border-border px-4 py-3.5`, title
  `text-[15px] font-semibold`, optional `CoachEyebrow`, `OverlayCloseButton`.
- Body: `scrollbar-none flex-1 overflow-y-auto overscroll-contain`, inner
  `mx-auto w-full max-w-2xl px-4 py-4 flex flex-col gap-4`.
- Footer: `shrink-0 border-t border-border px-4 py-3`, inner
  `mx-auto w-full max-w-2xl flex items-center gap-3`.
- Textarea: `min-h-[9.5rem] w-full resize-y rounded-xl border border-border
  bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none
  focus:border-primary`.

### Founder rulings on chrome

- **No scrim without a slide behind it.** `SnippetScreenShell`'s
  `bg-gradient-to-b from-black/40` renders only when `hasSlideBehind`. A blind
  pass has no slide, so it gets no gradient. (*"delete the shadowing at the top"*)
- **No helper texts.** (*"delete all the helper texts from the app"*)
- **One block of text, never a box inside a box.** (*"keep one block type text no
  box in the box"*)
- **Upload / record controls centrally placed**, no surrounding card.

---

## 6 — Invariants. Breaking any of these is an automatic reject.

- **AC-9** — never surface a score, verdict, ratio or classifier number to a
  user. The queue count is **progress** (how much is done), never how well. A
  filled dot means only "answered".
- **CONSTRUCT** — one written operational definition, asking exactly one thing.
  The blind question is `CONFIDENCE_QUESTION` — *"Does the speaker sound
  confident here?"* — mirrored in `e2e/corpus.spec.mjs`. The retired
  charisma/stress/threat vocabulary must never reappear.
- **BLIND COACH / N1** — the coach labels blind. The blind branch in
  `CoachReviewOverlay` **returns before any slide, note, surface toggle or
  practice control is constructed** — a structural early return, not a hidden
  element. The backend redacts the same fields independently.
  `blindLabelingIsBlind.test.ts` enforces this and **must not be relaxed**; when
  markup moves, the fence follows it (that is why it asserts
  `return renderBlindPiece(`).
- **N2 — payload order.** `items` renders in the order given. The queue is
  band-shuffled server-side, so position is not a tell. **Re-sorting client-side
  rebuilds the tell.**
- **N3 — no default answer.** An answer is required; nothing is pre-selected.
- **LIVE LOOP** — never break record → process → Ideal Text → next Take. Coach
  review is asynchronous.
- **L1** — Ideal Text is the one persistent, user-controlled document. Later
  takes never rebuild or silently overwrite it.
- **L2** — only Manager-approved candidates surface, under the active versioned
  budget. Never surface a raw candidate.
- **L3** — machine prediction, owner routing, blind peer rating, coach judgment
  and detector verdict stay separate lanes. The review lane and the star lane
  import nothing from each other; the Lounge is the one hub allowed to know both.
- **Complexity ratchet** (`scripts/check-complexity-ratchet.mjs`) — grandfathered
  functions may only come **down**. `Lounge` and `CoachSnippetReviewCard` are
  both grandfathered: a branch added there must be paid for by taking one out.
  That is why `useJudgeWalk`, `parseReviewPiece`, `CoachDeliveryMount` and
  `renderBlindPiece` live at module level.
- **User-facing copy needs founder sign-off.** Every string a coach or student
  reads is founder-specified. Changing one is a product decision, not a tweak.

---

## 7 — Open items. Do not guess — ask the founder.

**1 — The CMS return leg is not built.** `CoachReviewOverlay.onBuildExercise`
sends the coach to `/cms/new/exercise/1?returnTo=<...>`, but **nothing under
`src/app/cms/` reads `returnTo`** (verified on `b699709`). The coach reaches the
CMS and has no way back into the queue. The receiving half — honour `returnTo`
when the exercise is finished — still has to be written. Confirm the exact exit
point in the CMS lane with the founder before wiring it.

**2 — The CMS admin-password gate.** `src/app/cms/new/page.client.tsx` reads the
admin password from `sessionStorage`, and on a miss does
`router.replace("/cms")`. A coach arriving from the review without that password
is bounced, losing the hand-off. Decide with the founder whether coaches get
CMS access, a scoped exception, or the link is hidden for non-admins.

**3 — Publish without an approved ideal text.** The UI allows it (the skip link)
and the backend permits it. That is intended today. If it should ever become a
gate, it is a **founder** decision and a **backend** change — never a UI-only
re-hide, which is exactly the failure the old wrap-up had.

**4 — `/coach/audit/[studentId]` renders `bucket.score.toFixed(2)`** and that
route has **no server auth gate**. It is outside this flow, but it is a live
AC-9 exposure. Raise it; do not silently fix it as part of this work.

---

## 8 — Verification before you push

Do all of it. A push that turns CI red costs a cycle and the reviewers' trust.

1. `npx tsc --noEmit`, lint, and the unit suite.
2. `node scripts/check-complexity-ratchet.mjs` — must not rise.
3. `src/components/willab/blindLabelingIsBlind.test.ts` — must pass **without
   being edited to accommodate you**. If it fails, your markup broke the fence.
4. Playwright: `e2e/corpus.spec.mjs` and the coach specs, via `e2e/_launch.mjs`.
   Note: **Playwright matches the LAST registered route first** — register a
   catch-all `**/api/v2/**` **before** the specific stubs, or it swallows them.
5. **Drive it in a browser.** Three of the bugs in this flow (cursor persisting
   across an id swap, the dot lagging the answer, the roster door opening the
   wrong panel) were invisible to every test and obvious in ten seconds of use.
6. Branch off current `origin/main`, ship via a gate-routed PR. Never auto-drop
   tables, columns or migrations.

---

## 9 — Filter stamp

Running the WILLAB DECISION FILTER on *this handover*:

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: F1-SUPPORT
WHY:      Documentation only — no code path, surface, data or copy changes.
          It unblocks the named in-flight task of handing the merged coach
          review flow (PR #388) to another engineer without the design
          drifting on re-implementation. Fences clear (it surfaces nothing:
          it restates AC-9/CONSTRUCT/BLIND-COACH/LIVE-LOOP as constraints).
          Locks clear (L1/L2/L3 restated, none changed).
REDIRECT: Nearest F1-advancing action once this lands — (4) sharpen Manager
          evidence selection / reduce manual coach load, which is what the
          judgement-first walk and the automatic save exist to do.
```

`FILTER: JUSTIFIED-SCAFFOLDING — cat {F1-SUPPORT} — fences {clear} — locks {clear} — redirect: reduce manual coach load`
