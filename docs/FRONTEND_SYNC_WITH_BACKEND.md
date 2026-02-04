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

## Homework flow (student) — API contract for backend

The frontend at `/dashboard/homework` is implemented and calls the BFF below. The BFF proxies to Flask **`/v2/homework/*`**. When the backend implements these, the flow will work without frontend changes.

| Method | Backend path | Request | Response |
|--------|--------------|--------|----------|
| POST | `/v2/homework/start` | `{}` | `{ session_id, warm_up_task_text }` |
| POST | `/v2/homework/session/<session_id>/recording-1` | Multipart: `audio` (file), `duration_seconds` | `{ performance_score_1, task_text }` |
| POST | `/v2/homework/session/<session_id>/metric-answers` | `{ metric_answer_1, metric_answer_2 }` | `{ final_task_text }` |
| POST | `/v2/homework/session/<session_id>/recording-2` | Multipart: `audio`, `duration_seconds` | `{ performance_score_2 }` |
| GET | `/v2/homework/session/<session_id>/questions` | — | `{ questions: [ { id, text, order_index? } ] }` |
| POST | `/v2/homework/session/<session_id>/post-answers` | `{ answers: [ { question_id, answer_text } ] }` | `{ report_text, performance_score_end }` |

Auth: same as other v2 student endpoints (`Authorization: Bearer <supabase_access_token>`). If a route is not implemented, backend may return 404; frontend shows a friendly “Homework flow is not available yet” message.

---

## What not to implement yet (no backend support)

- **Homework flow backend:** Frontend and BFF are ready; backend must implement `/v2/homework/*` as in the table above.
- **Report overwrite / context_long edit** in admin.
- **Student "get task by id"** beyond plan/select-task.

---

## Summary

- **Student:** Two flows — (1) Existing: session start → universal questions → … → one recording → post-answers → report. (2) **Homework:** `/dashboard/homework` → start → warm-up + record_1 → task text + metric answers → final task + record_2 → questions (or skip) → report. Homework uses `/v2/homework/*` when implemented.
- **Admin:** Use v2 admin endpoints for students, overrides, speaker profile, send-assignment, **warm-up tasks**, exercises, tasks, post-recording questions, **metric questions**, and **metric definitions** (labels). Proxy with admin token; handle 401/403 and error bodies (`code`, `error`).
- **Sync:** Keep types aligned with backend; BFF routes for homework are in place; backend implements `/v2/homework/*` when ready.
