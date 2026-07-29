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
a time. It reads this existing endpoint. **Two fields are new asks.**

| Field | Status | What the FE does with it |
|---|---|---|
| `audio_ref` + `start_offset_ms` + `duration_ms` | **CONFIRMED served** (founder, 2026-07-28) — nothing to do | The playback hero. Confirmed present per breakthrough, so the tab is genuinely a listening tab. |
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

## 4b. `PUT /v2/coach/snippets/<id>/star-verdict` — accept `why_final` / `replacement_text_final`

**This is the missing half of §7.3 — the editor now exists.** The coach can rewrite
what a star SAYS, from the star-review row itself ("Edit what it says"), and the
rewrite is sent **on the verdict PUT**, not on a separate endpoint:

```jsonc
{ "star_kind": "delivery", "star_device": "pace_fast", "verdict": "keep",
  "why_final": "She always talks this fast — this is her normal.",
  "replacement_text_final": "and that honestly floored me" }   // both optional
```

Riding the verdict write is deliberate and matches your own rule: *the edit→keep
PAIR is what trains*. Sending them together makes the half-state — an edit with no
verdict — unrepresentable at the wire.

**Two properties worth knowing before you wire it up:**

1. **Neither key is ever present unless the coach actually changed the text.** An
   unedited row's body is byte-identical to the one that works today. So if the BE
   rejects unknown keys, the blast radius is *edited rows only*, and the failure
   announces itself as your 400 rendered verbatim next to that row — the working
   verdict path that is already filling `star_verdicts` cannot regress behind it.
2. **"Changed" is measured against the coach's own last wording**, not the machine's
   original. Re-saving an untouched edited row sends no `why_final`; reverting an
   edit back to the machine's wording counts as a change and sends the original text
   as the final (read that as "the coach confirms the machine's wording"). There is
   no way to null a `*_final` back out from the UI — say if you want one and it is a
   small addition.

**Serve them back on the GET too** (`why_final`, `replacement_text_final` per star).
The FE already maps them: a re-opened row then shows the coach's wording rather than
the machine's, and the editor seeds from it — the same "current state, not a locked
answer" rule the verdict follows. Absent → the machine's wording shows, unchanged
from today.

Pairs with the `edited` flag in §4: once these columns are written, `edited` is
presumably derivable from them server-side, so you may not need a separate column —
the FE reads whichever you serve.

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

## 7. Post-ship corpus check — what the FE can and cannot account for

The BE's verification query after the first real coach session on the new surface
(paste into the Supabase SQL Editor):

```sql
SELECT 'star_verdicts' AS corpus, count(*) FROM star_verdicts
UNION ALL
SELECT 'annotation_events (' || field_name || ')', count(*)
  FROM admin_annotation_events GROUP BY field_name
UNION ALL
SELECT 'moment_suggestions coach-edited',
       count(*) FROM moment_suggestions WHERE why_final IS NOT NULL
                                           OR replacement_text_final IS NOT NULL;
```

Reading the three counts against what this frontend actually writes:

1. **`star_verdicts` — this FE writes it directly.** Every Keep / Wrong kind /
   Shouldn't-fire tap is one `PUT /v2/coach/snippets/<id>/star-verdict`. A coach
   session that judged N stars should produce N rows (re-judging upserts, so
   re-deciding a star does not add a row). **Zero here after a session with visible
   green pills would mean the PUT is 200-ing without persisting** — the FE cannot
   tell those apart, which is exactly why the row count is the better check.

2. **`admin_annotation_events` — this FE has no writer.** Nothing in this repo
   posts to it; the rows must be a server-side side effect of endpoints the FE does
   call, i.e. the coach's **Verify** (`POST /v2/coach/arc/<arc>/ideal-text/approve`)
   and **Publish** (`publishArc`). So the FE-side precondition for a non-zero count
   is simply: the coach pressed Verify and Publish. If both happened and the count is
   still zero, it is downstream of the FE. (Note: "annotation" in this frontend's own
   code means something unrelated — the coach's own audio upload mode.)

3. **`moment_suggestions.why_final` / `replacement_text_final` — the FE now writes
   these, via §4b.** When this handoff was first written no frontend surface existed
   for them, so a zero was ambiguous. It no longer is: the star-review row has an
   editor, and the rewrite rides the verdict PUT.

   Which makes the reading conditional on §4b being wired up server-side:
   - **Before the BE accepts `why_final` / `replacement_text_final`:** zero is
     expected. Edited rows will show your 400 verbatim; unedited rows keep saving
     exactly as they do now.
   - **After:** zero after a session in which the coach visibly rewrote a star means
     the keys are being accepted and dropped — the same class of silent failure the
     row count exists to catch.

---

## Where to verify

Both surfaces have real-browser specs that run against a stub of these exact payload
shapes — useful as executable examples of what the FE expects:

- `e2e/game.spec.mjs` (24 checks) with `src/app/dev/game/page.tsx` as the payload stub
- `e2e/star-verdicts.spec.mjs` (34 checks) with `src/app/dev/star-verdicts/page.tsx`

Mappers and their degradation rules: `src/services/api/arcGame.ts`,
`src/services/api/starVerdicts.ts`, `src/services/api/bestPresentation.ts`.
