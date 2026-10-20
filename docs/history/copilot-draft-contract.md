# Copilot Draft Contract

Status: proposed, implementation guardrail  
Scope: Training Studio draft editing, audit/approve/send flow, and learning-signal capture

## 1) Canonical field contract

The draft entity has two classes of fields:

- Editable fields (human-updated):
  - `email_draft`
  - `task_draft`
  - `script_draft`
  - `grade_draft`
  - `comment_draft`
  - `corrected_insight`
- AI baseline fields (model-generated, immutable baseline):
  - `ai_email_draft`
  - `ai_task_suggestion`
  - `ai_script_draft`
  - `ai_grade_draft`
  - `ai_comment_draft`
  - `ai_insight`

Rules:

- UI writes only editable fields (`*_draft`, plus audit fields).
- AI generation writes only `ai_*` baseline fields.
- Baselines are never overwritten by UI edits.
- Read rendering can use `editable ?? baseline` fallback, but persistence is always to editable fields.

## 2) Script naming and deprecation policy

To prevent source-of-truth drift:

- `script_draft` is the only editable script field for API and UI.
- `ai_script_draft` is the immutable baseline.
- `video_script` is legacy alias only.

Transition policy:

- During transition, backend may mirror `video_script` <-> `script_draft` for compatibility.
- New writes from UI and backend draft logic must target `script_draft`.
- After migration window, remove `video_script` from API responses and internal write paths.

## 3) API contract requirements

`GET /v2/admin/copilot/students/:id/drafts` must return canonical draft shape for each row:

- Always include identifiers:
  - `id`
  - `student_id`
  - `session_id` (nullable only when truly unknown)
  - `status`
- Include editable fields (nullable allowed).
- Include AI baseline fields (nullable allowed).
- Keep naming stable in snake_case. If camelCase is exposed by any service, BFF/client must normalize.

`PUT /v2/admin/copilot/students/:id/drafts`:

- Accept updates to editable fields only.
- Never erase baseline fields unless explicitly requested by migration/admin action.
- Return updated canonical draft in response body.

`PUT /v2/admin/copilot/students/:id/audit`, `POST .../approve`, `POST .../send`:

- Must operate on a guaranteed draft row (create-on-missing allowed and preferred).
- Should not rely on BFF reconstruction from unrelated entities.

`POST /v2/admin/copilot/students/:id/send` and fallback `POST /v2/admin/students/:id/drafts/:draftId/approve-send`:

- Response now includes send-assignment-aligned fields when available:
  - `sent`
  - `realtime_level`
  - `realtime_step`
  - `sniper_profile`
- Optional body may include `video_url` to override the draft video at send time.

## 4) Create-on-missing and fallback policy

Preferred behavior:

- `/drafts` endpoints are authoritative and available.
- If no row exists, backend creates one and returns canonical draft data.

Fallback policy:

- `next-clips` fallback is temporary only.
- If fallback is used, log structured warning with student/session and reason.
- Fallback mapping must include all canonical fields, especially `ai_*` baselines.
- Add an owner and removal date for fallback path.

## 5) Backfill and migration requirements

A one-time deterministic backfill is required to avoid user-visible empty states:

- If `email_draft` is null/empty and `ai_email_draft` exists, copy AI value into `email_draft`.
- If `task_draft` is null/empty and `ai_task_suggestion` exists, copy AI value into `task_draft`.
- If `script_draft` is null/empty and `ai_script_draft` exists, copy AI value into `script_draft`.

Operational requirements:

- Run idempotently.
- Emit counters:
  - scanned rows
  - updated rows
  - skipped rows
  - failed rows
- Store migration run metadata for auditability.

## 6) Learning signal contract

UI correction does not imply learning unless events are consumed downstream.

Event requirements:

- Emit annotation event on every user mutation of editable fields:
  - `email_draft` changed
  - `task_draft` changed
  - `script_draft` changed
  - audit/insight updates
- Event payload should include:
  - `student_id`
  - `session_id`
  - draft identifier
  - field name
  - previous value hash (or redacted prior value)
  - new value hash (or redacted value)
  - actor and timestamp

Pipeline requirements:

- A downstream consumer must read annotation events and produce training/export artifacts.
- Define an SLA from edit to dataset availability (for example, <= 24h).
- Add monitoring for:
  - ingestion lag
  - dropped events
  - schema/parse failures

## 7) Frontend behavior guarantees

Training Studio behavior must remain consistent:

- On load, prefill local editors from `editable ?? baseline`.
- Save actions always write editable fields only.
- UI should indicate baseline-vs-edited state where useful (for example, "AI vs you").
- If `session_id` is missing in queue row, reuse draft `session_id` when available.

## 8) Verification checklist

Release is complete only when all checks pass:

- API:
  - New student with no existing draft: GET returns auto-created canonical draft.
  - PUT draft updates editable fields and preserves baselines.
  - Audit/approve/send succeed without 404-on-missing-draft behavior.
- UI:
  - Message/task/script appear immediately for old rows and new rows.
  - User edits persist and re-open correctly.
  - Read-only cards and edit forms show the same source values.
- Data:
  - Backfill job completed with expected counts.
  - No significant fallback usage after rollout.
- Learning:
  - Annotation events present for each edit type.
  - Downstream consumer confirms ingestion and export availability.

## 9) Ownership

- Backend owner: canonical schema, create-on-missing, backfill, annotation event production.
- Frontend owner: display/edit semantics, field-name normalization safety.
- ML/Data owner: event ingestion, dataset export, monitoring and SLA.

