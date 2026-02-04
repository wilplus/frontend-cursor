# Frontend sync with backend (Flask v2 API)

Use this doc when building or updating the frontend so it stays in sync with the **current backend**. The backend is a **Flask API** under base path **`/v2`**. All v2 endpoints require **auth**: `Authorization: Bearer <supabase_access_token>`.

- **Student app:** Call the backend at `BACKEND_URL/v2/...` (or via BFF that proxies with the user's token).
- **Admin panel:** Call `BACKEND_URL/v2/admin/...` with the **admin user's** token. Backend checks admin via `admin_users`; return 403 if backend returns 403.

Implement **only** what the backend currently provides. Do **not** assume a "homework flow" with two recordings or endpoints like "get warm-up task" or "submit recording_1" — those are not implemented yet. The **current student flow** is: one v2 session → universal questions → optional exercise → pre-questions + task → **one** recording → post-answers → report.

---

## Base URL and auth

- **Base:** `https://<your-backend-host>/v2` (e.g. Railway URL; use `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL` in frontend).
- **Auth:** Every request (student and admin): `Authorization: Bearer <supabase_access_token>`.
- **Admin:** Same header; backend returns 403 if the user is not in `admin_users`.

---

## Student flow (current) — endpoints

1. **POST /v2/session/start** — Body: `{}` or `{ "session_id": "<uuid>" }`. Response: `{ "session", "session_id" }`.
2. **GET /v2/universal-questions** — List of questions.
3. **POST /v2/session/<session_id>/universal-answers** — Body: `{ "mood", "readiness", "mode_preference" }`. Response A: exercise step; Response B: plan (pre_questions, command_options, etc.).
4. **POST /v2/session/<session_id>/exercise-feedback** — Body: `{ "exercise_liked": true|false }` (only if step 2 returned exercise).
5. **POST /v2/session/<session_id>/select-task** — Body: `{ "task_id": "<uuid>" }` (if mode "I'll choose").
6. **POST /v2/session/<session_id>/intent** — Body: `{ "intended_emotion", "keywords": [string, string, string] }`.
7. **POST /v2/recordings/upload** — Multipart: session_id, task_id, audio (file), optional duration_seconds. Response: recording_id, performance_score, performance_metrics, metric_labels_snapshot.
8. **POST /v2/session/<session_id>/post-answers** — Body: `{ "answers": [ { "question_id", "answer_text" } ] }`. Response: report_text, performance_score, etc.
9. **GET /v2/session/status** — Returns session state / has_active_session.

---

## Admin panel — endpoints and BFF mapping

All under `GET/POST/PUT/DELETE .../v2/admin/...` with admin auth. Frontend BFF: `src/app/api/v2/admin/...` proxies to backend with token.

| Backend path | BFF route (Next.js) | Notes |
|--------------|---------------------|--------|
| GET/PUT /v2/admin/students, /students/<id>, /overrides, /speaker-profile, /send-assignment | students/route.ts, students/[id]/, overrides/, speaker-profile/, send-assignment/ | Existing |
| GET/POST /v2/admin/students/<id>/warm-up-tasks | students/[id]/warm-up-tasks/route.ts | Warm-up tasks list + create |
| PUT/DELETE /v2/admin/students/<id>/warm-up-tasks/<task_id> | students/[id]/warm-up-tasks/[taskId]/route.ts | Update, delete |
| GET/POST/PUT/DELETE /v2/admin/exercises, /tasks, /post-recording-questions | exercises/, tasks/, post-recording-questions/ | Existing |
| GET/POST /v2/admin/metric-questions | metric-questions/route.ts | Two metric questions (position 1, 2) |
| PUT/DELETE /v2/admin/metric-questions/<question_id> | metric-questions/[id]/route.ts | Update, delete |
| GET/PUT /v2/admin/metric-definitions or /metrics | metrics/route.ts (or metric-definitions/) | Metric label pairs (code, left_label, right_label) |

### Response shapes (admin)

- **GET warm-up-tasks:** `{ "warm_up_tasks": [ { "id", "user_id", "text", "order_index", "created_at" } ] }`
- **POST warm-up-tasks:** Body `{ "text", "order_index"? }`. Response: created task.
- **GET metric-questions:** `{ "questions": [ { "id", "position": 1|2, "text", "created_at" } ] }`
- **POST metric-questions:** Body `{ "position": 1|2, "text" }`
- **GET metric-definitions / metrics:** `{ "metric_definitions" }` or `{ "metrics" }` — array of `{ "code", "left_label", "right_label" }`

---

## What not to implement yet (no backend support)

- **Homework flow student steps:** Get warm-up task, submit recording_1, get AI task with metric_question_1/2, submit metric answers, submit recording_2, get/save report with performance_score_end. DB has columns for future use.
- **Report overwrite / context_long edit** in admin.
- **Student "get task by id"** beyond plan/select-task.

---

## Summary

- **Student:** One flow — session start → universal questions → (optional exercise) → pre-questions + task + intent → one recording → post-answers → report. Use v2 endpoints and response shapes above.
- **Admin:** Use v2 admin endpoints for students, overrides, speaker profile, send-assignment, **warm-up tasks**, exercises, tasks, post-recording questions, **metric questions**, and **metric definitions** (labels). Proxy with admin token; handle 401/403 and error bodies (`code`, `error`).
- **Sync:** Keep types (StudentProfile, session status, overrides keys, WarmUpTask, MetricQuestion, MetricLabel) aligned with backend; add BFF routes for every admin endpoint used; do not rely on homework-flow student APIs until backend implements them.
