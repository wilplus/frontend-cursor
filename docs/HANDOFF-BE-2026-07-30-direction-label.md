# BE handoff — `direction_label` is about to lose its only writer, and that breaks L2

**Date:** 2026-07-30 · **From:** FE (frontend-cursor) · **Blocks:** deleting the blind labeler
**One question, at the bottom. Everything above it is the evidence.**

---

## The situation

The founder has replaced charisma/stress with **confident voice / not confident** as the main
labelling engine, and asked the FE to delete the old blind-labeler interface
(`CoachSnippetReviewCard` — the Direction chips, the stress↔charisma potentiometer, the "potentially
a key moment" badge).

The FE has **not** deleted it, because that card is the **only writer** of `direction_label`, and
`direction_label` is load-bearing in ranking.

## What `power_score` actually is

`services/power_phrase_ranking.py:100`:

```python
return _W_C * coach + _W_A * a + _W_S * s + _W_D * d + b + _W_V * v
```

| term | weight | range | source | survives the deletion? |
|---|---|---|---|---|
| `coach` (tag strong/to_work_on) | `_W_C = 2.0` | ±2.0 | coach | ✅ yes, tag lives elsewhere |
| `a` (activation, `1/rank`) | `_W_A = 1.0` | 0 … 1.0 | LLM over transcript text | ✅ |
| `s` (slide_stickiness) | `_W_S = 0.6` | 0 … 0.6 | LLM over transcript text | ✅ |
| **`d` (direction)** | **`_W_D = 1.0`** | **±1.0** | **`direction_label`, the card being deleted** | ❌ **dies** |
| **`b` (breakthrough)** | **`_W_B = 2.5`** | **0 or +2.5** | **the card being deleted** | ❌ **dies** |
| `v` (voice_confidence) | `_W_V = 1.0` | ±1.0 | acoustic composite, automatic | ✅ |

with `_DIRECTION_TERM = {"challenge": +1.0, "threat": -1.0, "ambiguous": 0.0}`.

## Why this is L2 and not a cosmetic loss

`services/voice_confidence.py`'s own header states it plainly: it is **"the DELIVERY half of the L2
blend"**, a *fixed, acoustic-only composite*. It is not coach-labelled and it is not the charisma
signal.

So the L2 blend today is:

- **delivery half** → `voice_confidence` (automatic, acoustic)
- **charisma half** → `direction` + `breakthrough` (coach-labelled, **from the card being deleted**)

Delete the card and ranking becomes `coach_tag + activation + slide_stickiness + voice_confidence`
— human verdict, content, and **delivery only**. That is exactly R8 in the decision filter ("rank
purely on delivery"), which **breaks L2**, the locked choice that ranking stays blended.

It would fail silently. Nothing errors; best-slide selection just quietly gets worse, and that is
F1 piece (b).

**Magnitude, so this isn't dismissed as a rounding error:** `_W_B = 2.5` is the largest automatic
term in the whole function — larger than the entire ±1.0 range of `voice_confidence`, and larger
than `activation` and `slide_stickiness` combined. A breakthrough currently outweighs everything
except the coach's own strong/to_work_on tag. Removing it is not a tweak to the blend; it removes
the single strongest automatic signal in it.

## The confident-voice labels do NOT currently fill the gap

I checked before writing this. `services/confidence_labels.py` (`confident` bool + `intensity` 1-5)
feeds the **recogniser training corpus**. There is **no path from coach confidence labels into
`power_score`** — no reference in `power_phrase_ranking.py`, `cross_take_selection.py` or
`best_presentation.py`. The only "confident" mentions in those files refer to the acoustic
`voice_confidence` composite.

So the new engine does not silently inherit the old engine's role in ranking. Somebody has to
decide that it does, and build it.

---

## THE QUESTION

**Under the confident-voice engine, what feeds `_W_D` (and what replaces the `_W_B = 2.5`
breakthrough bonus)?**

Three candidate answers. The FE has no basis to choose between them:

### (a) Confidence labels map onto the direction term
`confident` / `not confident` (+ `intensity` 1-5) becomes the charisma half.
Needs from you: the mapping. Does `confident → +1.0` and `not confident → -1.0`? Does `intensity`
scale it (e.g. `±intensity/5`), which would make the term continuous where it used to be ternary?
And what is the new breakthrough — is a not-confident→confident transition across takes the
successor to threat→challenge, and who computes it?

### (b) `voice_confidence` absorbs it and `_W_D` / `_W_B` are retired
**Please do not pick this without saying so explicitly.** By `voice_confidence.py`'s own
definition this collapses the blend to delivery-only, which is the R8 breach. If the founder wants
it, it needs to be an explicit L2 re-lock, in writing, not a consequence of a deletion.

### (c) Star verdicts feed it
Today they are `keep` / `wrong_kind` / `should_not_fire` — there is no direction in them, so this
needs a new mapping from you. Worth noting the founder said confident voice is extracted "from the
star reviews and the training corpus", which points here, but the current verdict vocabulary
cannot express a direction.

---

## What the FE needs, per answer

- **(a) or (c):** the field name and value domain on the snippet/candidate payload, and whether
  the term stays ternary or becomes continuous. FE surfaces nothing from this (AC-9) — this is
  purely so the deletion doesn't orphan the writer before the replacement exists.
- **(b):** written confirmation of the L2 re-lock. FE will then delete without a replacement.

Once answered, the FE deletes `CoachSnippetReviewCard`, `CoachReviewOverlay`,
`SnippetReadoutBlock`, `useCoachReview` and their Lounge mount in one pass, and re-aims
`starVerdictSeparation.test.ts` at the surface where blind labelling now lives (`/coach/corpus`).

## Two other channels die with the same card

Not this document's question, but they are in the same deletion and are covered in
`HANDOFF-BE-2026-07-30-confident-voice-and-star-video.md`:

1. **Coach note / Tag / Surfaced** write to `insights_payload` and are **shown to the student**.
   The star lane's note is coach→machine and never shown (N2). Delete the card and students stop
   receiving coach notes.
2. **`breakthrough_video_ref`** already has student consumers (BE-6, `arcGame.ts`).

## Correction to the earlier handoff

The first handoff listed option (b) as a live possibility without qualification. Having since read
`voice_confidence.py`'s header, that was too generous: `voice_confidence` **is** the delivery term
by explicit design, so (b) is not a neutral re-plumbing — it is an L2 breach that needs a founder
re-lock. Treat this document as authoritative where the two differ.
