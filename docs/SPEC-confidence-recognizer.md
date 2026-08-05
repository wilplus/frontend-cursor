# Confidence recognizer — FE pointer

**The canonical specification is not in this repo.** It lives in the backend:

- `backend-cursor/docs/SPEC.md` — canonical v3
- `backend-cursor/docs/SPEC-APPENDIX-A-verbal-computations.md`
- `backend-cursor/docs/SPEC-APPENDIX-B-progression.md`
- `backend-cursor/docs/SPEC-APPENDIX-C-intervention-contract.md`

This file exists so nobody reimplements from memory. It carries only what the
FE needs, and defers to SPEC.md on every point of conflict.

---

## What changed, in one line

The measured construct moves from **challenge/threat** to **confidence**, and
the instrument becomes **ternary** — yes / no / neutral on a single clip.

## The API, today

`PUT /v2/coach/snippets/<snippet_id>/confidence-label` accepts **both** bodies
through the cutover, so nothing on this side breaks by not being updated yet.

**New (preferred):**

```jsonc
{ "state_id": "confidence",
  "value": "yes" | "no" | "neutral",   // XOR unrateable
  "unrateable": false,                  // separate control, NOT a fourth value
  "note": "…",                          // optional
  "latency_ms": 1234 }                  // optional
```

**Legacy (still accepted, translated server-side):**

```jsonc
{ "confident": true, "intensity": 4, "note": "…" }
```

The response carries both shapes — `value` / `unrateable` / `lane` alongside
the legacy `confident` / `intensity` — so a component can migrate on its own
schedule.

`GET /v2/coach/sessions/<session_id>/confidence-queue` now returns
`label.value` and `label.unrateable` beside the existing fields. A row rated
before the migration has `value: null`, which means *not yet re-rated on the
new instrument* — not *unlabelled*.

## Three rules the FE has to hold

**1 · `neutral` and `unrateable` are different things, and the UI must not
merge them.** `neutral` says *this moment reads as middling*. `unrateable`
says *I cannot judge this*, usually because the audio is unclear. They must be
separate controls. Putting "can't tell" inside the answer group books unclear
audio as a real middling rating, and `neutral` is the class that defines the
decision boundary — it is the one that must stay clean.

**2 · The rating step is blind (I1).** The payload served for a rating carries
the moment and the question. No score, no band, no acoustic read, no comment.
Any change that adds "helpful context" to that screen breaks the corpus at
source, and it will look like an improvement while doing it.

**3 · The comment is revealed only after the rating is committed, and only if
it has been adjudicated.** Rate → submit → *then* the comment. An
unadjudicated moment plays with **no comment at all** — not a comment marked
provisional. At the current labelling rate most moments are never adjudicated,
so a "pending" badge would be the default state rather than the exception.

## Not yet — do not build ahead of the backend

| Surface | Status |
|---|---|
| Ternary in the **game** modal | backend slice 4; `answer_round` is still binary |
| `BreakthroughsOverlay` rename | slice 4, and it needs founder copy sign-off (LIVE LOOP) |
| Album surface | slice 5 |
| 2AFC paired comparison | v2 backlog — do not partially implement |

## When the album does arrive

Three constraints from SPEC §9.2, listed early because they are easy to design
away by accident:

- **It never names the state.** "You sounded confident here" is a verdict about
  the user under AC-9. The moment plays; the framing carries the meaning.
- **Predict-then-reveal is a mandatory hard gate** before any playback. Without
  the prediction step, anxious users anchor on flaws and the album makes them
  worse — that is a finding, not a caution.
- **Uncapped, grouped per project, plus a pool across projects.** Both levels
  are recency-first with the 5 most recent shown at the top. That is a display
  rule, not a retention rule: nothing ages out.
