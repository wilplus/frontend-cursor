# Taskmaster vs backend consolidated spec — alignment

This doc maps the **taskmaster app description** (this repo) to the **Homework / Speaking Coach MVP consolidated spec** (backend repo). Use it to see where they match.

**Taskmaster source:** `.taskmaster/docs/APP_DESCRIPTION.md`  
**Backend spec source:** Consolidated spec (CONTRACT-HOMEWORK-FLOW, DATA-MAPPING-SCORING, OPENAPI-V2-*, etc.) in the backend repo.

---

## Aligned

| Area | Taskmaster | Backend spec | Notes |
|------|------------|--------------|--------|
| **Status enum (5 values)** | `warm_up`, `task_block`, `final_task_ready`, `post_questions`, `completed` | Same 5; "don't add new statuses" for MVP | Step 1–5 derived only from status. |
| **Step order** | 0 start → 1 warm-up record → 2 metric answers (3 Qs) → 3 final record → 4 post-answers → 5 report | Same: recording_1 → pre-answers → final_task → recording_2 → post-answers → report | Flow order matches. |
| **Pre-questions count** | "Answers 3 questions" at step 2 | 3 pre-questions (Q1 keywords, Q2 emotion, Q3 CTA); snapshot `session_metric_question_1/2/3` | Aligned. |
| **GET status = source of truth** | Step only from GET session/status; overwrite on every response | Resume driven by GET status + payload; active = status in (warm_up, task_block, final_task_ready, post_questions); completed excluded from "active" | Aligned. |
| **Refetch after mutations** | After recording-1, metric-answers, recording-2, post-answers → GET status and apply | Idempotent writes; client should refetch status | Aligned. |
| **Session identity** | `sessionId = res.session_id ?? res.session?.id` | `session_id` and `session.id`; same value | Aligned. |
| **Warm-up text** | `warm_up_task.text` or `session.warm_up_task_text` | Snapshot `warm_up_task_text` on session | Aligned. |
| **Step 2 content** | Task block from `session_metric_question_1/2/3` or GET task-block | Backend does not send shaped task_block in status; snapshot 3 questions on session | Aligned. |
| **Final task text** | `session.final_task_text` only | Persisted `final_task_text` on session | Aligned. |
| **Report text** | `session.context_long` (not `report_text`) | Report in context_long / report_history; `report_text` may be alias | Aligned. |
| **End score** | `session.performance_score_end` | `v2_sessions.performance_score_end`; formula varies | Field name aligned. |
| **Step 4 questions** | GET questions when step 4 and questions empty; status has only post_question_ids | Post-questions from config; frontend GET questions when needed | Aligned. |
| **Recording upload flow** | recording-upload-url → Storage → POST recording-1/2 with JSON (path, duration) | Backend may accept multipart `audio` or path+duration; BFF uses URL upload + JSON | Contract aligned. |
| **One active session** | No session-scoped calls without valid sessionId; start when no active | Only one active session per student; start returns existing if active | Aligned. |
| **Idempotency** | Refetch status after each step | Upload/answers/report return existing if already past step (200) | Aligned. |

---

## Backend-only (no taskmaster change needed)

- Warm-up selection algorithm (tags, last 3 finished, max_performance_score, 0.03, weakness_match): in backend spec.
- Focus task selection (Simple Unlock, snapshot selected_task_*): backend; taskmaster says "task block from session or GET task-block."
- Compute-twice (recording_2 metrics recomputed after post-answers): backend.
- DB columns (performance_score_1/2/end, metric_answers, session_metric_question_1/2/3): backend / DATA-MAPPING.
- One report per session (unique constraint / guard): backend.
- Sanity checks (active = not completed; report creation atomic): backend.

---

## Summary

Frontend and backend taskmasters are compatible: same flow, 5 statuses, step derivation from GET status, refetch after mutations, session id, field names, upload flow, one active session, idempotency. Score formulas, warm-up/focus selection, DB schema, and migrations stay in the backend spec.
