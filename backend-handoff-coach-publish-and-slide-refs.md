# BE handoff: coach publish floor + presentation_ref nullability

**From:** Frontend
**Date:** 2026-06-19
**Scope:** Two BE contract gaps the FE is currently papering over. Both have shipped FE workarounds, but the workarounds are fragile and one of them masks a publish-failure bug. We want BE to own the correct behavior so the FE can delete the patches.

There are no FE blockers here. Everything below is "BE please fix at the source so we can simplify." The one item that is user-visibly broken today is **Issue 1.C (publish floor mismatch)**.

---

## Issue 1: Coach review and "Publish to user" flow

### Endpoints in play

| Method | FE (BFF) route | BE target | Purpose |
|--------|----------------|-----------|---------|
| GET  | `/api/v2/coach/sessions/{sessionId}` | `GET /v2/coach/sessions/{sessionId}` | Session review payload: `snippets[]`, each with `coach_state` (incl. `ai_draft_coach_note`) |
| POST | `/api/v2/coach/sessions/{sessionId}/snippets/{snippetId}` | `POST /v2/coach/sessions/{sessionId}/snippets/{snippetId}` | Per-snippet save; echoes back persisted `coach_state` |
| POST | `/api/v2/internal/publish-session-results` | `POST /v2/internal/publish-session-results` | Publish; flips `results_published_at`, fires user notification |

### Per-snippet save: request body the FE sends today
`src/services/api/coachReview.ts:271-276` — only these four keys are ever sent:
```
{ direction_label?, note?, tag?, surfaced? }
```
There is **no field to carry the AI draft note distinctly.** The FE copies `ai_draft_coach_note` into `note` to persist it (see 1.B).

### Publish: request body the FE sends today
`src/services/api/publishWillabSession.ts:64-72`:
```jsonc
{
  "session_id": "...",
  "insights_payload": {
    "overall_message": "..." | null,
    "snippet_notes": [
      { "snippet_id": "...", "note": "...", "tag": "strong" | "to_work_on", "when"?: "...", "examples"?: ["..."] }
    ]
  },
  "labels": [ { "snippet_id": "...", "value": "threat" | "ambiguous" | "challenge", "was_pre_filled"?: bool, "was_overridden"?: bool } ],
  "notify_client": true
}
```

---

### 1.A — Snippets do not default to `surfaced=true` server-side

**Symptom.** On a fresh session fetch, `coach_state.surfaced` comes back falsy for every snippet. Product intent is that all snippets are shown to the user by default and the coach *unsurfaces* the ones to hide. The FE parser treats any non-`true` value as `false` (`coachReview.ts:116` → `surfaced: r.surfaced === true`), so we cannot tell "BE meant false" from "BE omitted the field."

**FE workaround.** `src/components/willab/CoachSnippetReviewCard.tsx:138-148` — an on-mount `useEffect` that POSTs `surfaced: true` for every snippet that isn't already surfaced. This fires N writes on every overlay open.

**Requested BE change.** On `GET /v2/coach/sessions/{id}`, default each snippet's `coach_state.surfaced` to `true` for a session the coach has not yet touched. Coach toggles persist as before. This lets us delete the auto-surface half of the mount effect.

---

### 1.B — AI draft note is never persisted; FE has to copy it into `note`

**Symptom.** `coach_state.ai_draft_coach_note` (the AI-Commentator draft from process time) is returned read-only and is never promoted into the editable `note`. Since the per-snippet save body has no field for the draft note, the coach's "note" stays empty until the FE forcibly seeds it.

**FE workaround.** Same mount effect (`CoachSnippetReviewCard.tsx:138-148`): when `aiDraftNote` exists and `note` is empty, the FE POSTs `note: aiDraftNote`. Without this, every snippet ships with an empty note and the publish floor (1.C) can never be met.

**Requested BE change** (pick one):
1. **Preferred.** On first fetch of an untouched session, server-side promote `ai_draft_coach_note` into `coach_state.note` so the coach starts from the draft and edits down. No FE seeding needed.
2. **Alternative.** Accept `ai_draft_coach_note` (or an explicit `note` seeded from it) in the per-snippet save and persist it. This keeps the FE seeding but makes it a clean single field rather than a copy-through.

**Open question.** Is `ai_draft_coach_note` meant to be immutable (always the process-time draft, even after the coach edits `note`), or should it disappear once accepted? The FE currently re-reads it fresh on every fetch (`coachReview.ts:164-167`), so it never "sticks." Confirm the intended lifecycle.

---

### 1.C — Publish floor mismatch (this is the user-visible bug)

**The contract as the FE understood it.** `publishWillabSession.ts:9-10` documents the BE floor as:
> "BE validates the publish floor (every snippet labeled + ≥1 noted+tagged) and 422s a violation."

**What the FE actually gates on now.** `src/components/willab/CoachReviewOverlay.tsx:94-99` — `floorMet` was relaxed to:
> ≥1 snippet with `surfaced === true` **and** non-empty `note`. Direction label **not** required. Tag **not** required.

And at publish time (`CoachReviewOverlay.tsx:111`) the FE defaults a missing tag: `tag: cs.tag ?? "strong"`.

**Why this broke publish.** If BE still enforces the strict floor ("every snippet must have a `direction_label`"), then the relaxed FE gate lets the coach click **Publish** while the payload still has unlabeled snippets, and BE 422s. The coach experiences "the button does nothing / publish fails." The FE relaxation only works if BE relaxed in lockstep. Right now they are out of sync.

**Requested BE change.** Align the floor to the intended UX and make it lenient:
- Require only **≥1 surfaced snippet with a non-empty `note`** to publish.
- `direction_label` is **optional** (private training lane; not a publish gate).
- `tag` is **optional**: if a `snippet_notes[].tag` is missing/null, default it server-side (to `strong`) rather than 422. Today the FE fakes this default; BE owning it lets us stop sending a possibly-wrong tag.
- On a real violation (zero surfaced+noted snippets), keep the 422 but return a machine-readable `error` string (the FE already surfaces `b.error`, see `publishWillabSession.ts:84-88`).

**Open questions for BE.**
1. What does the floor enforce *today*, exactly? Per-snippet `direction_label` required? `tag` required on every note? We need the current rule to know whether 1.C is already aligned or still mismatched.
2. Is there any case where `notify_client: false` changes the validation? (FE sends `false` for edit-republish, `true` for first publish.)

---

## Issue 2: `presentation_ref` is unreliable at the group level

`presentation_ref` is the deck PDF URL the FE feeds to PDF.js (`SlideRender`) to render real slide pages. When it is null, slides degrade to a plain text card.

### Endpoints in play

| Method | FE (BFF) route | BE target | Purpose |
|--------|----------------|-----------|---------|
| GET | `/api/v2/user/strengths` | `GET /v2/user/strengths` | Slide-grouped strong-sides: `presentations[]` with group ref, `best_lines`, `takes[]` |
| GET | `/api/v2/explore/arc/{arcId}/best-presentation` | `GET /v2/explore/arc/{arcId}/best-presentation` | `ready`, `progress`, `slides[]`, top-level `presentation_ref` |
| GET | `/api/v2/explore/arc/{arcId}/progress` | `GET /v2/explore/arc/{arcId}/progress` | `takes_done`, `takes_target`, `takes_remaining`, `ready` |
| PUT | `/api/v2/explore/arc/{arcId}/best-presentation/slides/{index}` | same | Save edited slide `text` |

### Symptom
In `/v2/user/strengths`, the **group-level** `presentations[].presentation_ref` is frequently null even when individual `presentations[].takes[].presentation_ref` are populated, all pointing at the same deck. The FE can't render group/best-lines slides as PDFs without a group ref.

### FE workaround
`src/services/api/strengths.ts:144-147` — `mapPresentation` falls back to the first take that has a non-null ref:
```ts
presentationRef:
  typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
    ? r.presentation_ref
    : takes.find((t) => t.presentationRef != null)?.presentationRef ?? null,
```
Downstream degradation when even that is null: `SlideRender` falls back to `TextSlide` (`src/components/willab/pdfSlides.tsx:178-192`), and `LibraryOverlay` `MomentCard` falls back to `TextSlide` then `SlidePlaceholder` (`src/components/willab/LibraryOverlay.tsx:729-741`).

### Requested BE change
1. In `GET /v2/user/strengths`, **always populate group-level `presentation_ref` when any take in that group has one.** At group-assembly time, if the group ref is null, elevate the first non-null take ref. Removes the FE fallback entirely.
2. In `GET /v2/explore/arc/{arcId}/best-presentation`, ensure the top-level `presentation_ref` is present whenever the arc has an attached deck. Only return null when there genuinely is no deck.

### Open questions for BE
1. Within one presentation group, can different takes point at different decks, or is it always one deck per group? (Determines whether "elevate first take ref" is always safe.)
2. Is the group-level ref stored or computed? If computed from takes, why is it sometimes null when takes have refs?
3. For best-presentation: when is a null `presentation_ref` legitimate (no deck attached) vs a serialization bug (deck attached but not returned)?

---

## Summary of asks

| # | Ask | Removes FE workaround | User-visible? |
|---|-----|------------------------|---------------|
| 1.A | Default `coach_state.surfaced=true` on untouched sessions | `CoachSnippetReviewCard.tsx:138-148` (surface half) | No |
| 1.B | Promote `ai_draft_coach_note` → `note` server-side (or accept it in save) | `CoachSnippetReviewCard.tsx:138-148` (note half) | No |
| 1.C | **Relax + document the publish floor: ≥1 surfaced+noted; direction optional; default missing tag** | `CoachReviewOverlay.tsx:94-99, 111` | **Yes — publish currently fails** |
| 2.1 | Always return group-level `presentation_ref` when any take has one (`/v2/user/strengths`) | `strengths.ts:144-147` | Yes (slides render as text) |
| 2.2 | Always return top-level `presentation_ref` for best-presentation when a deck exists | `bestPresentation` text fallback | Yes (slides render as text) |

The FE will keep all workarounds in place until BE confirms each change is live, then remove them in a follow-up PR.
