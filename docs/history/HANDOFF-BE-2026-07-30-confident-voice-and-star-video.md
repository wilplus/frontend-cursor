# BE handoff — confident voice as the labelling engine, star video, and the deletion that is BLOCKED

**Date:** 2026-07-30 · **From:** FE (frontend-cursor) · **Status:** one half shipped safe-ahead, one half blocked on you

## The change the founder asked for

1. `charisma` / `stress` is replaced by **confident voice / not confident** as the main labelling
   engine. Confident voice is extracted from the **star reviews** and the training corpus.
2. The old blind-labeler interface (`CoachSnippetReviewCard`: Direction chips, the stress↔charisma
   potentiometer, the "potentially a key moment" badge) should be **deleted**.
3. The coach video moves from that deleted card onto the **star review**, under the note. Record or
   upload, it stays, replace or delete it, and **recording counts as approval**.

Point 3 is shipped FE-side. Point 2 is **blocked** — see the channel audit. Do not read the FE's
silence on point 2 as "done".

---

## PART A — shipped FE-side, needs your endpoints

`starVerdicts.ts` now maps `video_ref` on each star row and calls two endpoints. Both degrade
safely: absent `video_ref` → `null` → the slot renders as "add one", which is the correct read.

### A1. `POST /v2/coach/snippets/<snippet_id>/star-video` (multipart)

| field | notes |
|---|---|
| `video_file` | the video |
| `upload_idempotency_key` | **required.** A re-send under the same key is the SAME take, deduped — never a second row. A new recording mints a new key. |
| `device` / `source` | optional provenance. `source: "in-app-recording"` marks an in-app capture. |
| `duration` | optional seconds |

Response: `{ "video_ref": "<url>" }` or `{ "star": { "video_ref": "<url>" } }`. FE reads either.

Same Subsystem V field names as the existing breakthrough-video uploader, so one multipart parser
can serve both.

### A2. `DELETE /v2/coach/snippets/<snippet_id>/star-video` → 200

**Deleting the video must NOT retract the verdict.** Recording implied approval; deleting is "I'd
rather say it in words", not "I take it back". The coach retracts by tapping another verdict (N5).

### A3. `video_ref` on the star row in `GET /v2/coach/arc/<arc_id>/stars`

### A4. Recording sets `keep`

When a video lands, the FE immediately PUTs `verdict: "keep"` through the normal
`/star-verdict` path — no new write shape, no special-casing your side. Still re-judgeable (N5).

**Fence note:** the FE could not reuse the breakthrough uploader, because the star lane may not
import the label lane (`starVerdictSeparation.test.ts`). The duplication is deliberate.

---

## PART B — BLOCKED. Deleting the labeler loses three channels

The founder asked me to make sure no channel is lost. Three are, and none can be fixed FE-side.
`CoachSnippetReviewCard` is the **only writer** of all three.

### B1. `direction_label` — this one breaks L2

`power_score` (`services/power_phrase_ranking.py`) is:

```
_W_C·coach + _W_A·activation + _W_S·slide_stickiness + _W_D·direction + breakthrough + _W_V·voice_confidence
```

- `direction` → `_DIRECTION_TERM = {challenge: +1.0, threat: -1.0, ambiguous: 0.0}`
- `breakthrough` → `_W_B = 2.5`, the top automatic signal

Both come from the coach's Direction chips on the card being deleted. Delete the card and both
terms go to **0.0 forever**, leaving `coach_tag + activation + slide_stickiness + voice_confidence`
— content and delivery only.

That is R8 in the decision filter ("rank purely on delivery") and it **breaks L2**, the locked
choice that ranking stays blended. This is not a UI regression; it silently degrades best-slide
selection, which is F1 piece (b).

**Question B1:** under the confident-voice engine, what feeds `_W_D`?
- (a) confident-voice labels map onto the direction term (what maps to `challenge` / `threat`?), or
- (b) `voice_confidence` absorbs it and `_W_D` is retired — **note this is R8 unless the confidence
  term is genuinely the charisma signal and not the delivery one**, or
- (c) star verdicts feed it (they are `keep`/`wrong_kind`/`should_not_fire` — no direction in them
  today, so this needs a new mapping from you).

FE cannot pick. Nothing should be deleted until this is answered.

### B2. The coach's user-facing note has no home in the star lane

Two different audiences, easy to conflate:

| | writes to | who sees it |
|---|---|---|
| `CoachSnippetReviewCard` → Coach note / Tag / Surfaced | `insights_payload` | **the student** |
| `CoachStarVerdictOverlay` → Add note | star corpus | **nobody but the machine** (N2) |

Delete the card and **students stop receiving coach notes entirely**. The star note cannot absorb
them without breaking N2, which says a verdict is silent toward the student.

**Question B2:** where do coach→student notes live after the deletion? Either the star lane gains an
explicitly student-facing field (and N2 is amended in writing), or a separate surface keeps it.

### B3. The breakthrough video already has a student consumer

`breakthrough_video_ref` is uploaded from the card being deleted, and BE-6 surfaces the threat ones
on the student feedback page. `arcGame.ts` reads it too.

**Question B3:** is the new star video the same asset re-homed (in which case B3 folds into A1 and
the student surfaces should read `video_ref`), or a second, coach-only asset? The FE has assumed
**coach-only** (N2) — if it should reach students, say so, because that changes the fence.

---

## What the FE will do once you answer

1. Delete `CoachSnippetReviewCard`, `CoachReviewOverlay`, `SnippetReadoutBlock`, `useCoachReview`
   and their Lounge mount (self-contained subtree, mounted only from `Lounge.tsx`).
2. Delete the stress↔charisma potentiometer and the "potentially a key moment" badge.
3. Rewrite `starVerdictSeparation.test.ts`: with the blind lane gone the N1 fence has no second side,
   so it must be re-aimed rather than deleted — most likely at "no machine guess reaches the
   confident-voice queue" (`/coach/corpus`), which is where blind labelling now lives.
4. Retire `DirectionLabel` / `Direction` and the `labels` half of the publish payload.

## Also flagged, separately

`services/charisma_snippet_service.py` ranks charisma clips with the **stress** model
(`stress_baseline_model_path`). Verified harmless to F1 — it steers clip SELECTION only, and MMR
diversity re-spreads the picks — but if the construct is now confident voice, the model key, the
`known_gaps` id `charisma_uses_stress_model`, and the `charisma_snippets` table name are all
mis-named for the new world. Worth renaming in the same pass so the vocabulary stops drifting.

## FE verification status

`tsc` clean, 754 tests / 57 files green. Browser verification of the new video slot was blocked
locally by the app's service worker serving cached dev chunks; the compiled bundle was confirmed to
contain the component. The endpoints above do not exist yet, so the slot cannot be exercised
end-to-end until A1–A3 land.
