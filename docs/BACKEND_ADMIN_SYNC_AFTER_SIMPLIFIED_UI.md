# Backend sync: Admin panel simplified (keep API in sync)

**Use this prompt in your backend repo** so the API stays aligned with the current Next.js admin panel.

---

## Frontend API paths (no `v2` in URL)

The frontend now calls **`/api/admin/*`**, **`/api/session/*`**, **`/api/homework/*`** (no `v2` in the path). The Next.js BFF proxies these to your backend at **`BASE_URL/v2/admin/*`**, **`BASE_URL/v2/session/*`**, **`BASE_URL/v2/homework/*`**. **You do not need to change your backend routes** — keep serving under `/v2/...` as today.

---

## What changed on the frontend

The admin UI was simplified to **two routes only**:

1. **`/admin/students`** — List of students (email, sessions count, avg score, last active). Click a row → student profile.
2. **`/admin/students/:id`** — Single student profile page with three sections (no separate Exercises / Tasks / Questions / Metrics pages).

All configuration is done **from the student profile**:

- **Homework Configuration** (one card): Warm-up tasks (per student), Focus tasks (assigned from global pool), Post-recording questions (exactly 3 from global pool), Metrics (5 fixed, label-only edit). Buttons: **Send Homework** (outline), **Save** (primary).
- **Speaker Profile** (one card): Single **Context** textarea; saved as **speaker profile** (frontend sends it as `coach_notes`; you can store in one field or split as you prefer).
- **Reports History**: List of past reports (from `sessions[].report_preview.report_text_preview` + `created_at`).

The frontend **no longer has** dedicated admin pages for Exercises, Tasks, Questions, or Metrics. Those routes redirect to `/admin/students`. **The backend must still expose the same admin APIs** because the student profile page uses them:

- **Tasks** — Global pool. Profile shows “Focus tasks” = tasks assigned to this student (`overrides.assigned_next_task_ids`). Admin can add/remove via a modal (select from pool or create new). So you still need: **GET /v2/admin/tasks**, **POST /v2/admin/tasks**, **PUT /v2/admin/tasks/:id**, **DELETE /v2/admin/tasks/:id**.
- **Post-recording questions** — Global pool. Profile shows exactly 3 assigned (`overrides.assigned_post_question_ids`). Modal: select 3 from pool or create new. So you still need: **GET /v2/admin/post-recording-questions**, **POST**, **PUT /:id**, **DELETE /:id**.
- **Warm-up tasks** — Per-student list. Profile shows list; “Add” opens a modal to select from current list or create new (create = new warm-up task for this student). So you still need: **GET /v2/admin/students/:id/warm-up-tasks**, **POST** (create), **PUT /:task_id** (update text), **DELETE /:task_id**.
- **Metrics** — Single global set of 5 label pairs. Profile shows “Metrics (5 fixed)” with inline edit of `left_label` / `right_label`. So you still need: **GET /v2/admin/metrics**, **PUT /v2/admin/metrics** with body `{ "metrics": [ { "code", "left_label", "right_label" }, ... ] }`.
- **Exercises** — No longer used in the simplified UI (frontend redirects `/admin/exercises` to students). You can keep or remove the exercises API; the current profile does not call it.

---

## Contract the frontend relies on

### Students

- **GET /v2/admin/students** — List. Response: `{ "students": [ { "user_id", "email" | "user_email", "sessions_count?", "last_session_at?", "avg_performance?" } ] }`. Query: `limit`, `offset` optional.
- **GET /v2/admin/students/:id** — Profile. Response must include:
  - `user_id`, `email`
  - `overrides`: at least `assigned_post_question_ids` (string[], length 3 when set), `assigned_next_task_ids` (string[])
  - `speaker_profile`: at least `coach_notes` (frontend sends the single “Context” here); other fields optional
  - `sessions`: array of `{ id, created_at, status?, report_preview?: { report_text_preview?: string } }` (and optional `recording_preview`, etc.)
- **PUT /v2/admin/students/:id/overrides** — Body may include only `assigned_next_task_ids` and/or `assigned_post_question_ids` (and optionally others). Frontend sends these when admin clicks Save after choosing focus tasks and post-recording questions.
- **PUT /v2/admin/students/:id/speaker-profile** — Body: `{ coach_notes?: string, ... }`. Frontend sends the single Context textarea as `coach_notes`.
- **POST /v2/admin/students/:id/send-assignment** — No body. Response: `{ "status": "ok" }` or similar.

### Warm-up tasks (per student)

Each warm-up task has **max_performance_score** (0–1) used by the homework flow to select which warm-up to show (see **WARM_UP_SELECTION_SPEC.md**).

- **GET /v2/admin/students/:id/warm-up-tasks** — Response: `{ "warm_up_tasks": [ { "id", "user_id", "text", "order_index?", "max_performance_score"?: number (0-1), "pool_task_id"?, "created_at?" } ] }`.
- **POST /v2/admin/students/:id/warm-up-tasks** — Body: `{ "text": string, "order_index"?: number, "max_performance_score"?: number (0-1) }`. Response: `{ "warm_up_task": { id, user_id, text, order_index?, max_performance_score?, created_at? } }`.
- **PUT /v2/admin/students/:id/warm-up-tasks** — **Sync from pool.** Body: `{ "pool_task_ids": string[] }` (ordered list of pool task UUIDs). Replaces the student's warm-up tasks with copies from the pool in this order. Response: `{ "warm_up_tasks": [ ... ] }`. Required for the admin "Manage list" → Confirm selection to work.
- **PUT /v2/admin/students/:id/warm-up-tasks/:task_id** — Body: `{ "text"?: string, "order_index"?: number, "max_performance_score"?: number (0-1) }`. Response: updated warm_up_task object.
- **DELETE /v2/admin/students/:id/warm-up-tasks/:task_id** — No body. Response: 200 or `{ "status": "ok" }`.

### Tasks (global pool)

- **GET /v2/admin/tasks** — Response: `{ "tasks": [ { "id", "title", "prompt_text?", "min_task_score?", "max_task_score?", "is_active?", "created_at?" } ] }`.
- **POST /v2/admin/tasks** — Body: `{ "title": string, "prompt_text"?, ... }`. Response: `{ "task": { ... } }`.
- **PUT /v2/admin/tasks/:id** — Body: partial (e.g. `{ "title": string }`). Response: `{ "task": { ... } }`.
- **DELETE /v2/admin/tasks/:id** — Response: 200 or `{ "status": "ok" }`.

### Post-recording questions (global pool)

- **GET /v2/admin/post-recording-questions** — Response: `{ "questions": [ { "id", "text", "answer_type", "code?", "is_active?", "order_index?" } ] }`.
- **POST /v2/admin/post-recording-questions** — Body: `{ "text": string, "answer_type"?: string }`. Response: `{ "question": { ... } }`.
- **PUT /v2/admin/post-recording-questions/:id** — Body: partial (e.g. `{ "text": string }`). Response: `{ "question": { ... } }`.
- **DELETE /v2/admin/post-recording-questions/:id** — Response: 200 or `{ "status": "ok" }`.

### Metrics (global, 5 fixed)

- **GET /v2/admin/metrics** — Response: `{ "metrics": [ ... ] }` or `{ "metric_labels": [ ... ] }`. Each item: `{ "code": string, "left_label": string, "right_label": string }`. Frontend expects at least one and displays up to 5; it sends the full array on PUT.
- **PUT /v2/admin/metrics** — Body: `{ "metrics": [ { "code", "left_label", "right_label" }, ... ] }`. Response: `{ "status": "ok" }` or similar.

---

## Behaviour to preserve

1. **Auth** — All `/v2/admin/*` requests must require a valid Supabase JWT and an admin check (e.g. admin_users). Return 401 when unauthenticated, 403 when not admin.
2. **Students list email** — `GET /v2/admin/students` must return `email` (or `user_email`) per student so the UI can show emails instead of UUIDs.
3. **Reports history** — `GET /v2/admin/students/:id` must include `sessions` with `report_preview.report_text_preview` and `created_at` so the profile can show “Reports History” cards.
4. **Overrides** — Accept and persist `assigned_next_task_ids` (array of task IDs) and `assigned_post_question_ids` (array of exactly 3 question IDs). The frontend validates “exactly 3” for questions before Save; you may enforce it on the backend as well.

---

## Optional / deprecated from UI

- **Exercises** — The simplified admin has no Exercises page. The frontend does not call GET/POST/PUT/DELETE for exercises in the new flow. You can keep these endpoints for future use or remove them; no change required for the current UI.
- **Metric questions** (position 1 & 2) — The current student profile does not show a separate “metric questions” section; it only shows the 5 metric label pairs. If your backend has metric-question endpoints, they are still used by the homework flow (student-facing); the admin profile just doesn’t edit them in this simplified UI.

---

## Summary for backend

- Keep **Students** (list + profile), **Overrides**, **Speaker profile** (at least `coach_notes`), **Send assignment**.
- Keep **Warm-up tasks** (per student) CRUD.
- Keep **Tasks** and **Post-recording questions** as global pools with full CRUD; the profile uses them via assignment (`assigned_next_task_ids`, `assigned_post_question_ids`).
- Keep **Metrics** GET/PUT (array of `{ code, left_label, right_label }`).
- Exercises API is unused by the new UI; optional to keep or remove.
- Auth and error handling unchanged (401/403, JSON error body with `error` and optional `code`).

Once the backend matches this contract, the simplified admin panel (students list + student profile with Homework Configuration, Speaker Profile, Reports History) works without further frontend changes.
