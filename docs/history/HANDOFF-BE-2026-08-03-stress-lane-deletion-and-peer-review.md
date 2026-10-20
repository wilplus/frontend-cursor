# BE handoff — delete the stress lane, wire the peer-review validation loop

**Date:** 2026-08-03 · **From:** FE (frontend-cursor) · **Founder decision:** stress
recognition is dead; the feature is pivoted into a **peer-review validation loop**
(a user/peer flags whether the AI's confidence choice was correct — true/false).

FE side is done on this branch. Everything below is the BE's half.

---

## 1. What the FE already removed

| Piece | Where | Status |
|---|---|---|
| Lane 3 card ("acoustic stress baseline") | `/admin/learning` | **removed** — the page now renders two lanes |
| `LaneAcoustic` / `lane_acoustic` types | `components/admin/learningTrace.ts` | **removed** — a trace that still serves the section is tolerated (unread keys) |
| Legacy user label route (`user_label: "charisma" \| "stress"`) | `src/app/api/v2/user/snippets/[snippetId]/label/route.ts` | **deleted** — it was orphaned since the Phase 5 funnel replacement; nothing FE-side calls it |

Explicitly NOT touched, because they are different features, not the classifier lane:
the public interview `tone` steering, the v1 coaching `intent` (stress/charisma
scenarios), the coach audit "stress as fuel" analytics, and the #190 coach-only
acoustic potentiometer (whose deletion remains **blocked** on the `direction_label`
L2 question — see `HANDOFF-BE-2026-07-30-direction-label.md`; nothing here unblocks it).

## 2. What the BE must delete (the founder's list, verbatim intent)

- **The `subprocess.run` training loop inside the request handler** (30-min
  timeout). The whole second-lane trainer goes; no replacement trainer.
- **The auto-promote default.** No surviving code path may promote a model
  artifact without the quality gate + a human decision.
- **The local-file-path fallback on storage failure** — the one that promotes a
  path on Railway's ephemeral filesystem and dies at the next deploy. Delete the
  fallback, not just the call site.
- The lane's corpus plumbing: the admin `stress-snippets` /
  `charisma-snippets` label endpoints, `POST /v2/user/snippets/<id>/label`
  (legacy enum body), and the `lane_acoustic` section of
  `services/learning_trace.py` (optional — the FE now ignores it either way).
- `runtime_config` key `stress_baseline_model_path` (and its promote writer).

**One dependency to confirm before deleting:** the promoted stress model fed
**clip selection only** (Lane 3's own subtitle). The no-model state already runs
"heuristic suspicion scoring only", so deletion means that heuristic becomes the
permanent selector. If clip selection has since grown a harder dependency on the
model, say so before deleting — don't let selection silently regress.

## 3. New endpoint — the peer-review capture

The FE ships `POST /api/v2/user/snippets/<snippet_id>/confidence-review`
(BFF, auth-required, verbatim relay) and a client
(`services/api/confidenceReview.ts`). The BE needs:

```
POST /v2/user/snippets/<snippet_id>/confidence-review        @require_auth
Body:    { ai_correct: boolean, model_version?: string }
Success: { saved: true, snippet_id, ai_correct }
```

- **Strict boolean.** `"true"` (string) is a **400, not a coercion** — same
  principle as the coach confidence-label route: this is training data, and a
  coerced value is a fabricated label.
- **Replace-on-reflag.** One row per `(snippet_id, reviewer_user_id)`; a
  re-flag updates it. Duplicate peer rows are junk labels (same N3 logic as the
  voice game).
- `model_version` records WHICH prediction was validated. Absent → attribute
  the currently-shadowed version server-side.

Table sketch:

```sql
create table snippet_confidence_reviews (
  id                uuid primary key default gen_random_uuid(),
  snippet_id        uuid not null references snippets(id),
  reviewer_user_id  uuid not null,
  ai_correct        boolean not null,
  model_version     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (snippet_id, reviewer_user_id)
);
```

## 4. Routing into the Loop B corpus — provenance is the whole game

The founder's intent: these flags eventually feed the **main** recogniser's
retraining corpus as ground-truth human labels. Two constraints so the corpus
survives that:

1. **Separate provenance, always.** Ingest as
   `selection_source = "peer_review"` — the trace already breaks the corpus
   down `by_selection_source`, so the mix stays visible on `/admin/learning`.
   Peer flags are **non-blind** (the reviewer saw the AI's choice before
   flagging), unlike the coach labels, which stay blind (N1/N2 — untouched by
   all of this). Mixing the two indistinguishably would let the model grade
   its own homework: validation of a prediction correlates with the
   prediction, and an unlabeled blend risks a confirmation feedback loop.
   Whether/how to weight peer labels vs. blind coach labels is a founder/BE
   call — the schema just has to keep the choice possible.
2. **Retrain triggers count them explicitly.** Whether `peer_review` rows
   count toward the ≥50 corpus / ≥25-new retrain trigger is a decision, not a
   default — decide it when wiring the ingest, and say which way in the trace.

## 5. The surface itself (not shipped here)

The FE shipped the **capture path only**. The screen that shows the AI's
confidence choice and asks "did it get this right?" needs founder-signed copy
before it exists (LIVE LOOP), and it must stay **off the blind game rounds** —
a round must be answered blind first (or on a separate surface entirely), or
the AI's read leaks into the blind peer-guess lane and poisons those labels.
