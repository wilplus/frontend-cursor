# Taskmaster vs backend consolidated spec — alignment

This doc maps the **taskmaster app description** (this repo) to the **Homework / Speaking Coach MVP consolidated spec** (backend repo). Use it to see where they match and where they differ or are silent.

**Taskmaster source:** `.taskmaster/docs/APP_DESCRIPTION.md`  
**Backend spec source:** Consolidated spec (CONTRACT-HOMEWORK-FLOW, DATA-MAPPING-SCORING, OPENAPI-V2-*, etc.) in the backend repo.

---

## Aligned

| Area | Taskmaster | Backend spec | Notes |
|------|------------|--------------|--------|
| **Status enum (5 values)** | `warm_up`, `task_block`, `final_task_ready`, `post_questions`, `completed` | Same 5; “don’t add new statuses” for MVP | Step 1–5 derived only from status. |
| **Step order** | 0 start → 1 warm-up record → 2 metric answers (3 Qs) → 3 final record → 4 post-answers → 5 report | Same: recording_1 → pre-answers → final_task → recording_2 → post-answers → report | Flow order matches. |
| **Pre-questions count** | “Answers 3 questions” at step 2 | 3 pre-questions (Q1 keywords, Q2 emotion, Q3 CTA); snapshot `session_metric_question_1/2/3` | Aligned. |
| **GET status = source of truth** | Step only from GET session/status; overwrite on every response | Resume driven by GET status + payload; active = status in (warm_up, task_block, final_task_ready, post_questions); completed excluded from “active” | Aligned. |
| **Refetch after mutations** | After recording-1, metric-answers, recording-2, post-answers → GET status and apply | Idempotent writes; client should refetch status | Aligned. |
| **Session identity** | `sessionId = res.session_id ?? res.session?.id` | `session_id` and `session.id`; same value | Aligned. |
| **Warm-up text** | `warm_up_task.text` or `session.warm_up_task_text` | Snapshot `warm_up_task_text` on session | Aligned. |
| **Step 2 content** | Task block from `session_metric_question_1/2/3` or GET task-block | Backend does not send shaped task_block in status; snapshot 3 questions on session | Aligned. |
| **Final task text** | `session.final_task_text` only | Persisted `final_task_text` on session | Aligned. |
| **Report text** | `session.context_long` (not `report_text`) | Report in context_long / report_history; `report_text` may be alias | Aligned. |
| **End score** | `session.performance_score_end` | `v2_sessions.performance_score_end`; formula varies (see gaps) | Field name aligned. |
| **Step 4 questions** | GET questions when step 4 and questions empty; status has only post_question_ids | Post-questions from config; frontend GET questions when needed | Aligned. |
| **Recording upload flow** | recording-upload-url → Storage → POST recording-1/2 with JSON (path, duration) | Backend may accept multipart `audio` or path+duration; BFF in this repo uses URL upload + JSON | Contract aligned; backend can accept either. |
| **One active session** | No session-scoped calls without valid sessionId; start when no active | Only one active session per student; start returns existing if active | Aligned. |
| **Idempotency** | Refetch status after each step | Upload/answers/report return existing if already past step (200) | Aligned. |

---

## Misaligned or taskmaster silent

| Area | Taskmaster | Backend spec | Action |
|------|------------|--------------|--------|
| **Start when no warmups** | Says “POST start” when no active session; no error detail | **422 NO_WARMUP_CONFIGURED**; no session created | Taskmaster should state: if backend returns 422 (no warmups), show message and do not treat as active session. |
| **Status “active” definition** | Uses `has_active_session` and session payload | **Active = status IN (warm_up, task_block, final_task_ready, post_questions)**; completed must not be returned as active | Taskmaster already implies “no active = start”; add that GET status must not return completed sessions as active. |
| **Recording_2 duration gate** | Not mentioned | **60–300 seconds** or **422 RECORDING_DURATION_OUT_OF_RANGE** | Taskmaster should note: recording_2 must be 1–5 min; backend rejects with 422 if out of range. |
| **Metric-answers body shape** | “POST metric-answers” | **q1_keywords**, **q2_emotion** (enum), **q3_cta**; canonical storage `answer_1/2/3` | Taskmaster doesn’t specify request body; frontend must send keys backend expects (or BFF maps). |
| **Report generation trigger** | Step 5 “Views report”; GET status gives report | Backend: **report generated inside POST post-answers** (no separate POST /report); status → completed | Taskmaster doesn’t say “no separate /report”; aligned if frontend never calls POST /report and gets report from status after post-answers. |
| **Score formulas** | Only “performance_score_end” | **score_1** (3 metrics avg), **score_2** (5 metrics avg); **performance_score_end** = (score_1+score_2)/2 in metrics-only MVP; or 0.65*metrics_2+0.35*task_execution_score if AI scoring | Taskmaster doesn’t specify formula; backend spec is authoritative. |
| **score_transcription / task_execution_score** | Not mentioned | Optional; when used: task_execution_score in JSON; final_score = 0.65*metrics_2+0.35*task_execution; on failure final_score = metrics_2 | Taskmaster silent; no change needed unless frontend displays AI score separately. |
| **Error codes** | 409, 403, 404 mentioned in “what could go wrong” | **NO_ACTIVE_SESSION**, **NO_WARMUP_CONFIGURED**, **INVALID_STATE**, **RECORDING_DURATION_OUT_OF_RANGE**, **VALIDATION_ERROR**, etc. | Taskmaster could list main codes so frontend can show messages. |
| **Transcript retrieval** | Not mentioned | **GET /v2/recordings/{id}**; 404 for not found/not allowed; returns transcription_text | Taskmaster could add: “To show full transcript, GET /api/recordings/{id} (BFF → backend).” |
| **6-state vs 5-state** | Uses 5 statuses only | Spec once had 6-state (recording_1_ready, etc.); **locked to 5** for MVP (warm_up, task_block, final_task_ready, post_questions, completed) | Taskmaster is correct; no change. |

---

## Backend-only (no taskmaster change needed)

- Warm-up selection algorithm (tags, last 3 finished, max_performance_score, 0.03, weakness_match): in backend spec / WARM_UP_SELECTION_SPEC; taskmaster points to docs.
- Focus task selection (Simple Unlock, snapshot selected_task_*): backend; taskmaster says “task block from session or GET task-block.”
- Compute-twice (recording_2 metrics recomputed after post-answers): backend; taskmaster doesn’t need to describe.
- DB columns (performance_score_1/2/end, metric_answers, session_metric_question_1/2/3): backend / DATA-MAPPING; taskmaster uses same field names for display.
- One report per session (unique constraint / guard): backend.
- Sanity checks (active = not completed; report creation atomic): backend.

---

## Summary

- **Aligned:** Flow, 5 statuses, step derivation from GET status, refetch after mutations, session id, warm-up/task block/final task/report/score field names, upload flow, one active session, idempotency.
- **To add in taskmaster (short):** 422 on start when no warmups; GET status must not return completed as active; recording_2 duration 1–5 min and 422 if out of range; optional note on metric-answers body (q1_keywords, q2_emotion, q3_cta); optional note that report is produced in post-answers (no separate /report); optional pointer to transcript via GET recordings/{id}.
- **Leave to backend spec:** Score formulas, score_transcription, error code list, warm-up/focus selection details, DB schema, migrations.
