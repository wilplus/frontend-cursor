# Coach review flow — judgement first, one action per screen

**Status:** founder-specified 2026-09-18. Every fork below was decided explicitly;
where this spec reverses an earlier call, it says so.

A walkable prototype of this flow lives beside this file: `prototype.html`
(open it in a browser — it is a single self-contained file, no build).

## Why

The coach reaches the blind judgement pass only by opening Feedbacks review from the
student screen, scrolling to a take row, tapping it, then dismissing the star panel with
the X — because the take review opens *underneath* it. So the coach walks through the
machine's guesses to reach the blind pass that is supposed to come first.

## The flow

```
Your students (StudentRosterOverlay)          unchanged
  student (StudentDetailOverlay)              ONE door: "Review <topic>"
    Judgement, take 1                         rebuilt screen, one piece per screen
    Judgement, take 2                         same screen, next take
      Feedbacks review                        unlocked only when every piece is judged
        Wrap up                               one action: "Open the ideal text"
          Ideal text                          one action: "Approve the ideal text"
            Message to the user               only reachable after approval
              Review and send                 one action: "Publish the full analysis"
                student screen, take reads Done
```

Two detours leave the path and return: a take row on the Feedbacks review opens the
contextual pass, and the CMS links below.

## Decisions

| Fork | Call |
|---|---|
| Doors on the student screen | **One**, routed into judgement. Keeps the 2026-08-10 "one way in" rule. |
| Queue scope | **One queue per take** — take 1, then take 2. |
| Delivery scope | **One delivery per arc** — both takes reach the student together. |
| Exercises + coach video | **Live in the CMS.** The review only links out and comes back. |
| Publish location | **Its own final screen.** The star lane's copy is removed. |
| Ideal text | **Optional.** Publishing never waits for it. |
| Message to the user | **Its own screen**, reachable only by approving the ideal text. |
| Save | **Automatic**, on leaving the Feedbacks review. No Save button. |
| Publish label | "Publish the full analysis". |
| Screens | **One action each.** |

## 1 — One judgement screen

Adopt the corpus label queue (`src/app/coach/corpus/page.client.tsx`) as the canonical
design for the blind confidence pass, on **both** review lanes.

- One piece per screen. `renderBlindConfidencePass` in `CoachStarVerdictOverlay.tsx`
  (~line 481) currently stacks every `cvRows` entry on one scroll — it becomes a paged
  queue like the corpus one.
- Header strip: progress dots (filled = answered, amber pulse = saving, ring = current,
  tappable to jump) and `n / m labelled` on the right.
- Body: player, question, the shared `ConfidenceLabelChips`, then the optional note.
- Footer: `Back` plus one forward control.
- Scope: one queue per take. Delivery stays per arc — do not split delivery per take.

Extract the chrome into ONE shared component that all three surfaces mount rather than
copying it a third time; see the header of `coachChrome.tsx` for why. Keep the surfaces
separate; share only chrome.

**Unify the question.** `CONFIDENCE_QUESTION` in `stateRatings.ts` says "Does the speaker
sound confident here?"; the corpus queue and the star lane hardcode "Was this voice
confident?". Pick one, from the constant, and delete the literals.

**Advance behaviour.** In-between / Not sure / Audio unclear advance automatically.
Yes and No **hold the screen**, because they reveal the exercise CTA and the note.
The forward control is then `Next`; on an unanswered piece `Skip`; on the last piece of a
completed queue `Judge take 2` or `On to the feedback`.

## 2 — Delete the scrim

`SnippetScreenShell.tsx:50-65` floats the indicator and close X over
`bg-gradient-to-b from-black/40 to-transparent`, with the X on `bg-black/30`. That scrim
keeps those controls legible **over a slide**. The blind pass has no slide, so it renders
as a grey smear on white.

The component already has the escape hatch — `isCoachMessage` hides exactly this block for
exactly this reason. Generalise it rather than adding a second boolean. Remove the
element; do not leave a transparent div.

## 3 — CMS hand-off (not designed here)

The CMS owns exercise definition and video recording outright: `LaneShell.tsx`,
`LaneSteps.tsx`, `RecordStep.tsx` under `src/app/cms/new/`. **Design nothing there and add
no fields to it.** The review's entire contribution is:

1. Two CTAs into the existing lanes — `/cms/new/exercise/1` from a Yes or a No on the
   judgement screen, and the record lane from the message screen's Upload a file / Record
   pair.
2. A `returnTo` param on the way in.
3. Honouring it on the way back: the same piece in the same take's queue, or the message
   screen.

Both navigate in the **same tab**. Add `?piece=<n>` alongside the existing
`?review=<sessionId>` deep link (`Lounge.tsx:155`, U12) so the queue restores its position.

Two things already make this safe:

- The CMS is **this same Next app**. Its own comment says the step is in the URL so that
  "the coach's review panel [can] link straight to `/cms/new/exercise/1` without ever
  showing the fork" — this link was anticipated.
- The overlay **already mirrors unsaved state to localStorage** (`coachReviewDraft`,
  debounced 400ms) as crash insurance. A navigate-away-and-back is that case exactly.

**Known blocker (founder's call, not the implementer's):**
`src/app/cms/new/page.client.tsx:66-74` reads an admin password from `sessionStorage` and
`router.replace("/cms")` when there is none. A coach without that password bounces. The
CTA is still correct; access is a separate decision.

## 4 — Judgement first, from the student list

`StudentDetailOverlay.tsx:197-229` offers only "Ideal text ready to review" and "Feedbacks
review"; the per-session list was deleted on 2026-08-10 ("we just need the feedbacks review
list"). Keep that one-door rule — do not add a second button. The single review door
**routes into the judgement queue first**, and Feedbacks review becomes reachable only once
every piece for that arc is judged.

**Fix the stacking bug that forces the X.** In `Lounge.tsx`, `CoachReviewOverlay` mounts at
~1588 and `CoachStarVerdictOverlay` at ~1645. Both are `fixed inset-0 z-40`, so DOM order
wins and the star panel paints over the take review it just opened via `onOpenTakeReview`.
Move the star-verdict block **above** the review block: it still stacks over
`StudentDetailOverlay` (~1558, which the comment at 1640 protects), and the take review then
correctly stacks over it. No z-index churn.

## 5 — One delivery, one place, never gated on the ideal text

- **Remove the star lane's publish block** (`renderCoachStarPublishSection`,
  `CoachStarVerdictOverlay.tsx:777`). That screen ends on its take rows; its footer carries
  `Back` and `Wrap up`.
- **Publishing gets its own final screen, "Review and send"**: a plain list of what the
  student is about to receive (snippets surfaced, notes and labels, ideal text, message,
  coach video), and one action — `Publish the full analysis`.
- **The ideal text is optional and never blocks publishing.** Verified both sides:
  `pickBlocker` in `coachReviewState.ts` accepts only `NO_TAKES`, and the server's
  `publish-analysis` (`backend routes/v2/coach.py:4124`) rejects only `NOTHING_TO_PUBLISH`
  and an invalid reviews list. `test_eager_ideal_text.py:411` asserts
  `IDEAL_TEXT_NOT_APPROVED` is an advisory, never a blocker. Only the wrap-up turns it into
  a gate by hiding the button. Drop that gate.
- **After a successful publish, return to the student screen** with that arc's take showing
  **Done**. Note `onPublished` calls `reviewQueue.markDone(sessionId)` for ONE session; with
  one delivery covering both takes, mark every session in the arc or refetch the student
  detail on return. Landing on a screen that says Done for take 1 and pending for take 2 is
  worse than not returning.

## 6 — Screen contents

**Wrap up.** The single action `Open the ideal text`, centred at normal CTA size, with
`Skip it and send what you have` in the footer going straight to Review and send. No Save
button, no overall-message field (it moves), no coach video.

**Ideal text.** Unchanged body; footer holds one action, `Approve the ideal text`. Verify
still waits until the end of the text has scrolled into view. Approving leads to the message
screen.

**Message to the user.** Its own screen, reachable only by approving the ideal text. The
message textarea (today's `overall_message`, moved off the wrap up), the centred
Upload a file / Record pair, then `Review and send`. A coach who skips the ideal text never
sees this screen and the student receives no message.

## 7 — Save is automatic

The explicit Save disappears. Persist the take (the `saveCoachFeedback` payload: per-snippet
note, tag, surfaced, plus the overall message) **when the coach leaves the Feedbacks review
for the wrap up**. Keep the batching itself — note/tag/surfaced stay local until that one
commit, because they are user-facing and a half-written note must not reach the student
early (see the header of `CoachSnippetReviewCard.tsx`). Do not switch to per-keystroke saves.

## 8 — Visual rules

- **One action per screen.** The forward action is a single full-width black button.
  Secondary escapes are a footer button or an underlined text link, never a second primary.
- **All primary CTAs are black**, not orange. Orange stays on accents only.
- **No helper text** on these screens.
- **Flat fields**: a plain label above its control, no card wrapping a card.
- Keep the audience eyebrow (`PRIVATE · TRAINING`) — it is the split-sink marker, not helper
  text.
- A button inside a scrolling flex column must not `flex-grow`.

## Invariants — do not break any of these

- **N1 / BLIND COACH.** No machine read, band, score, ordering cue or colour standing in for
  one may reach the judgement screen. The backend stamps `saw_model_output: false` on every
  rating written there. The contextual half must keep returning *before* it is constructed,
  not be hidden with CSS.
- **N2.** Render the queue in payload order — band-shuffled server-side so position is not a
  tell.
- **N3.** An answer is required; no default, no pre-selection. The note is gated behind an
  answer or abstention and saves on blur without advancing.
- The transcript stays hidden until that piece's own answer is committed.
- `CoachInlineBlindExposureBoundary` still wraps every piece carrying a `blindReview`
  handle; chips stay disabled until an `exposureId` exists.
- The value/abstention XOR stays enforced in one writer.
- **AC-9.** Counts are progress, never quality.

## Verification

- `scripts/local_ci.sh` — the gate.
- `starVerdictSeparation.test.ts` must still pass: `coachChrome` imports neither lane.
- `node e2e/corpus.spec.mjs` and `node e2e/star-verdicts.spec.mjs` against
  `npx next dev -p 3111`. Update where the DOM moved; do not delete assertions.
- By hand: student → judgement take 1 → take 2 → feedbacks → wrap up → ideal text →
  message → review and send → back on the student with the take reading Done, never tapping
  an X to reveal a screen.

## Out of scope

The contextual pass's own layout, the corpus workbench, `/coach/compare`, `/coach/errors`,
`/coach/audit`, and every backend contract.

## Filter stamp

`FILTER: ADVANCE-F2 — cat {F2} — fences {clear} — locks {clear} — redirect: n/a`

Hardens coach-review lineage and the blind-labelling instrument without delaying F1-CORE.
Copy on these screens is coach-facing and founder-specified here.
