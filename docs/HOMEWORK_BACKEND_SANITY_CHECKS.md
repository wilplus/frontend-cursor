# Homework flow — backend sanity checks (guardrails)

Two low-effort guardrails to prevent regressions. Implement these in the **backend** (and DB).

---

## 0) Warm-up task: use admin-assigned list in student flow

**Goal:** The warm-up tasks that the admin configures per student (in the admin panel, via `/v2/admin/students/:userId/task-warm-up` and the warm-up task pool) must be the **same** tasks the student sees when they start or resume homework.

**Why it doesn’t show up otherwise:** The **student flow** does not call the admin API. It only calls:

- `POST /v2/homework/session/start`
- `GET /v2/homework/session/status`

So the **backend** that implements these homework endpoints must:

1. Identify the current user (student) from the auth token.
2. Load that student’s **assigned warm-up tasks** (the same list the admin manages: e.g. `v2_student_warm_up_tasks` or whatever stores the result of admin “Assign warm-up tasks” / pool sync).
3. When creating a new session (`POST session/start`) or when returning status with an in-progress session (`GET session/status`), **pick one** warm-up task (e.g. by `max_performance_score` band or `order_index`) and include it in the response as:
   - `warm_up_task: { id: string, text: string }` and/or
   - `warm_up_task_text: string`

If the homework handlers do **not** read from the student’s assigned warm-up task list and instead return a hardcoded or empty task, the admin-configured tasks will **never** appear in the student flow.

**Contract:**  
“For the authenticated user (student), `POST /v2/homework/session/start` and `GET /v2/homework/session/status` must return a warm-up task that comes from that student’s assigned list (the same data the admin configures). If the student has no assigned tasks, return 422 with code `NO_WARMUP_CONFIGURED` (or equivalent) so the frontend can show ‘No warm-up tasks configured’.”

---

## 1) One report per session (DB-level)

**Goal:** Avoid creating multiple reports for the same session even if a bug (e.g. double submit) slips in.

**Options (pick one):**

- **A)** If you have a `v2_reports` table with `session_id`, add a **UNIQUE constraint** on `v2_reports.session_id` so the DB rejects a second insert/update for the same session.
- **B)** Rely on `v2_sessions.report_id`: set it **once** when the report is created, and in the handler that creates the report, **check** that the session is not already completed (e.g. `status != 'report_generated'` or `report_id IS NULL`) before creating and linking a report.

**Recommendation:** Use both if possible: unique on `session_id` in `v2_reports` (or equivalent) plus a guard in the post-answers/report-creation handler so you never try to create a second report for a completed session.

---

## 2) Status endpoint: active session only (no completed)

**Goal:** `GET /v2/homework/session/status` (or your BFF proxy) should return the **current active (incomplete) session** only. Completed sessions must **not** be returned as the “active” session.

**Why:** The frontend uses `/status` to **resume** an in-progress attempt. If a completed session is returned, the user would “resume” into the report screen and could be confused, or the frontend would treat it as the current session. By excluding completed sessions:

- After the user finishes (report generated), the next time they open the homework page the frontend gets **no active session** from `/status` and calls **POST session/start** to begin a **new** attempt.
- You avoid “resume last completed” unless you explicitly add a different endpoint (e.g. “get last report”) later.

**Implementation:**

- In the backend, the query that feeds “current homework session” (e.g. `v2_get_active_homework_session()` or equivalent) must **exclude** sessions whose status is **completed** / **report_generated** (or where `report_id IS NOT NULL` if that implies completion).
- So: **active** = has `session_id`, not yet in a terminal state (e.g. `status IN ('created', 'warmup_recorded', 'task_generated', 'recording2_uploaded', 'post_questions_done')` and **not** `report_generated`).

**Contract for frontend:**  
“GET /session/status returns the single active (incomplete) homework session for the current user, or null if there is none.” Completed sessions are not considered active.

---

## Checklist

- [ ] **Reports per session (DB + handler):**
  - **DB:** UNIQUE(report.session_id) if that column exists; otherwise rely on session.report_id.
  - **Handler:** In `homework_submit_post_answers`, lock session row; only create report if `status != 'completed'` AND `report_id IS NULL`.
- [ ] **Status endpoint active-only:**
  - In `v2_get_active_homework_session()` (or status handler query), return only sessions with  
    `status IN ('warm_up', 'task_block', 'final_task_ready', 'post_questions')`  
    (exclude `completed`).

After these are in place, the frontend behavior (resume only in-progress, start new after completion) stays correct and double-report creation is prevented at the DB/handler level.
