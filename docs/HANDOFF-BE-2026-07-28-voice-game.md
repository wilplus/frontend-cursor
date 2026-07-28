# BE handoff — Voice-game + star verdict (FE side is live on `main`)

**From:** frontend-cursor · **Date:** 2026-07-28
**Status:** FE shipped and merged. Everything below is what the BE must serve for
the shipped screens to show real content. Nothing here is blocking a deploy — every
field is mapped defensively and its absence degrades to a narrower-but-correct
screen, never an error. This document lists exactly what "narrower" means so the
BE can decide what is worth serving.

---

## 1. `GET /v2/explore/arc/<arc_id>/breakthroughs` — three fields for "Best voices"

The Voice-game's second tab ("Best voices") plays the coach-confirmed moments one at
a time. It reads this existing endpoint. **Two fields are new asks; one is a check.**

| Field | Status | What the FE does with it |
|---|---|---|
| `audio_ref` + `start_offset_ms` + `duration_ms` | **check** — please confirm these are served per breakthrough | The playback hero. Without `audio_ref` the play button renders **disabled** — the tab becomes text-only, which defeats the tab. This is the single highest-value item here. |
| `comment` (alias `why`) | **NEW** | The system's explanation, used **only** when the coach left no note. |
| `video_ref` (alias `breakthrough_video_ref`) | **NEW** | The coach's breakthrough video for that moment, rendered under the comment. |
| `breakthrough_note` (alias `note`) | already served | The coach's note. |

**Display rule the FE enforces (founder 2026-07-28): ONE comment, never two.**
`breakthrough_note` **overrides** `comment`. If both are served, only the coach's is
rendered — so the BE may safely serve both and let the FE pick. If neither is served,
no comment block renders at all.

Everything is defensive: non-string → dropped; absent → `null`; a breakthrough with
no audio still renders (disabled hero + comment).

---

## 2. `GET /v2/arc/<arc_id>/game` — `audio_ref` is now load-bearing

The game rounds are **ear-first**: per the founder's design pass the round no longer
shows the transcript at all. The user hears the moment and calls it.

- `audio_ref` **must** be present per round, or the round is unplayable and the user
  is guessing at silence. `start_offset_ms` / `duration_ms` clamp the slice (the spec
  already allows `start_offset_ms: null` — the FE handles that).
- The FE still reads `transcript` and drops rounds without one (the spec guarantees
  non-empty), but it is no longer displayed. It can stay in the payload.

No other change to this endpoint. Ordering, the `?snippet=` pin, and the
`{rounds: [], reason: "NO_KEY_MOMENTS_YET"}` empty state all behave as specified and
are exercised by `e2e/game.spec.mjs`.

---

## 3. `POST /v2/arc/<arc_id>/game/answers` — `truth_is_key` is the N5 fallback

Already in the contract; noting how it is used so it is not dropped as cosmetic.

The reveal is now **one paragraph**: the bold verdict word heads the comment itself —
`**Correct** 🥳 The load-bearing words in this moment: …` (emoji only on a correct
call; an incorrect call is the same format with no emoji, because a wrong call is
usually the user hearing their own solid moment as a key one).

`truth_is_key` renders as that paragraph's body **only when `why` is empty** — the
neutral "This one was solid — not a key moment." line. So:

- `why` non-empty → `truth_is_key` is not displayed, but is still the thing that
  keeps the reveal honest if `why` ever comes back empty.
- `why` empty AND `truth_is_key` absent → the reveal is the bare verdict word. That is
  the one genuinely thin state; serving either field prevents it.

---

## 4. `GET /v2/coach/arc/<arc_id>/stars` — the `edited` flag

Per your 2026-07-28 note: *"the natural coach gesture is edit → keep — the pair only
enters the training corpus when the star is kept, so a star that's been edited but
never judged should nudge toward a verdict."*

The FE implements that nudge: an edited star with `verdict: null` wears an amber
**"Edited — add a verdict"** chip; once judged, the chip goes neutral and reads
"Edited". **It needs a per-star boolean** — the FE accepts any of:

```
edited  |  is_edited  |  coach_edited     → boolean true
```

Absent or non-boolean → `false` → no chip, no nudge, no visual change from today.
This is the only new field the star payload needs; the five audio fields shipped in
`f8c6c6c` are already mapped and working.

---

## 5. Not blocking, but still open on your side

- `migrations/add_star_verdicts.sql` — until it runs, the verdict PUT returns 500 and
  the FE shows the message verbatim (it names the migration). The list itself loads.
- `migrations/add_moment_suggestion_final.sql`.
- `add_game_saves.sql` — save/list degrade gracefully without it, per your handoff.

## 6. Explicitly NOT wanted (fences)

For the avoidance of doubt, since these endpoints feed user-facing surfaces:

- **No scores, streaks, accuracy or counts** anywhere in the game payloads (AC-9/N2).
  The FE renders position dots and would not render a tally if one arrived.
- **No is-key hint in the rounds payload** (N1) — no ordering tell, no flag, no field
  that correlates. The blind guess IS the annotation; a tell poisons both the training
  value and the peer label.
- The star payload's `summary.confusions` / `false_negatives_captured` are internal
  bookkeeping and are deliberately never mapped by the FE.

---

## Where to verify

Both surfaces have real-browser specs that run against a stub of these exact payload
shapes — useful as executable examples of what the FE expects:

- `e2e/game.spec.mjs` (23 checks) with `src/app/dev/game/page.tsx` as the payload stub
- `e2e/star-verdicts.spec.mjs` (28 checks) with `src/app/dev/star-verdicts/page.tsx`

Mappers and their degradation rules: `src/services/api/arcGame.ts`,
`src/services/api/starVerdicts.ts`, `src/services/api/bestPresentation.ts`.
