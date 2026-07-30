# The two coach feedback lanes

There are two channels through which a coach gives feedback. They look similar
on screen and they now share their chrome, but they are **separate surfaces on
purpose** and merging them is a fence breach, not a refactor.

This document exists because the vocabularies of the two lanes must not drift,
and because a shared *code* module holding both vocabularies would itself be the
breach. So the vocabulary is unified **here, in prose**, and deliberately not in
a shared TypeScript enum.

Written 2026-07-30, when the plumbing was unified and the surfaces were not.

---

## Lane 1 — the blind labeler

| | |
|---|---|
| Host | `CoachReviewOverlay.tsx` |
| Card | `CoachSnippetReviewCard.tsx` (one per snippet) |
| Also | `SnippetReadoutBlock.tsx`, `useCoachReview.ts` |
| Service | `services/api/coachReview.ts` |
| Payload types | `services/api/publishWillabSession.ts` |
| Endpoint | `GET/POST /v2/coach/sessions/<sessionId>` |
| Anchor | a snippet inside a **session / take** |
| Entry | the review wrap-up |
| Order | chronological, exactly as the BE returns it |

### Vocabulary

- **Direction** — `threat` | `ambiguous` | `challenge`.
  Defined **once**, as `DirectionLabel` in `coachReview.ts`.
  `publishWillabSession.ts` aliases it as `Direction` for the payload contract.
  Do not write a third copy of this union.
- **Tag** — `CoachTag`, from `components/willab/readout.ts`.
- **Surfaced** — a boolean: does the student see this snippet at all.

### Where it lands, and who sees it

Two sinks, and the split is the whole point:

- `direction` → `training_labels`. **Private. Training only. Never user-visible**
  (AC-9).
- `note` / `tag` / `surfaced` → `insights_payload`. **The student sees these.**

### The rule that defines this lane

**§S.3 label hygiene.** No best/worst pre-fill, no KPI, and **no machine
direction guess anywhere in the UI**. The coach labels blind. If the coach can
see what the model thought, the label stops being evidence and becomes
agreement, and the F2 corpus quietly becomes worthless.

### Save timing

**Batched.** Edits live in local state, mirror to the overlay via
`onStateChange` (which feeds a localStorage crash cache), and persist in one
shot at Save (R4-8). The breakthrough-video ref is the one exception, being a
server-side asset.

This is an **audience rule**, not a preference: `note` / `tag` / `surfaced` are
user-facing, so a half-written note must not be able to reach a student before
the coach commits.

---

## Lane 2 — the star verdicts

| | |
|---|---|
| Overlay | `CoachStarVerdictOverlay.tsx` |
| Service | `services/api/starVerdicts.ts` |
| Endpoints | `GET /v2/coach/arc/<arcId>/stars` · `PUT /v2/coach/snippets/<snippetId>/star-verdict` |
| Anchor | a star on an **arc** |
| Entry | its own entry on the student-detail screen, mounted as a Lounge sibling |
| Order | server-side: unjudged first, then by family. Never re-sorted client-side |

### Vocabulary

- **Verdict** — `keep` | `wrong_kind` | `should_not_fire`. `StarVerdict` in
  `starVerdicts.ts`.
- **Star family** — `emphasize` | `replace` | `structure` | `delivery`.
  `STAR_KINDS`, contract-fixed.
- **Device** — per-row, arriving in `device_options` (N4). Not a fixed enum;
  never reconstruct it client-side.

### The rule that defines this lane

This surface **deliberately shows the machine's guess**. Judging whether a star
should have fired is the entire task, so hiding the guess would empty the
screen. That is exactly why it cannot sit next to Lane 1.

**N2 — a verdict is silent toward the student.** The star still renders for them
exactly as before, **including on a `should_not_fire`**. `idealText.ts` must
never mention `star_verdict`, `wrong_kind`, `should_not_fire` or
`corrected_device`; the separation test asserts this.

**N3** — `wrong_kind` is never submittable bare. The pill only opens the picker;
the pick is the save.

**N5** — verdicts are re-editable. The PUT is an upsert, and a saved verdict
renders as current state, never as a locked answer.

### Save timing

**Immediate**, per row, with per-row in-flight guards. The mirror image of Lane
1: a verdict is never user-facing, so there is nothing to gate.

---

## What the two lanes share

Only **chrome**, in `components/willab/coachChrome.tsx`: `CoachChip`,
`CoachMetaPill`, `CoachEyebrow`, `CoachErrorLine`, `CoachCard`.

That file imports from neither lane and names no vocabulary from either one.
Both directions are enforced by `starVerdictSeparation.test.ts`, which also
asserts the chrome cannot become a bridge.

They also share one **convergence you should know about**: both ultimately hang
off the same `snippet_id`. Lane 2's verdict endpoint is snippet-addressed. The
data models have already met; it is the *surfaces* that must not.

## What must never be unified

1. **The screens.** Putting a machine guess on the blind labeling screen anchors
   the label. This is the BLIND COACH fence, and `starVerdictSeparation.test.ts`
   enforces the import graph in both directions. Do not add a star-verdict entry
   to the review wrap-up: that page is part of the labeling flow.
2. **The save models.** See both "Save timing" sections. The difference encodes
   who can see the data.
3. **The vocabularies, in code.** One shared enum module importable by both
   lanes is a bridge. Keep them apart and keep this document current instead.

Changing any of the three needs an explicit founder decision on its own terms,
per the NORTH-STAR LOCK. It is not a thing a refactor gets to do on the way past.
