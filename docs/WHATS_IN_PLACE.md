# What’s in place (frontend vs backend)

## Short answer

- **Admin:** Warm-up tasks, metric questions, students, overrides, exercises, tasks, post-questions, metrics, BFF routes — **in place.**
- **Student flow (only one):** **Frontend in place** at **`/dashboard`**. Single flow: warm-up text + record_1 → task text + metric answers → final task + record_2 → questions (or skip) → report. **Backend** must expose the homework endpoints (see “What’s needed” below); until then, “Start homework” shows a friendly error.

---

## Admin panel (in place)

- **Students:** List, profile, overrides, speaker profile, session history, Send Homework.
- **Warm-up tasks:** Per-student list; add, edit, delete. (Student does not see this yet — no student UI for it.)
- **Exercises, Tasks, Post-recording questions:** CRUD lists and modals.
- **Metric questions:** Two slots (position 1 and 2) on Metrics page; add, edit, delete.
- **Metric labels:** Get/put label pairs (e.g. left/right per metric).
- **BFF:** All admin calls go through `/api/admin/*` with the admin token (proxied to backend `/v2/admin/*`).

---

## Student app (single flow)

There is **one flow only**: warm-up + recording_1 → task + metric answers → final task + recording_2 → questions (or skip) → report.

- **Entry:** **`/dashboard`** — shows “Start homework” and then the steps above.
- **Frontend:** Done. Backend must expose `/v2/homework/*`; until then, “Start homework” shows a friendly error.
- **Legacy URLs:** `/dashboard/homework` and `/dashboard/v2` redirect to `/dashboard`.

---

## What’s needed for “warm_up + two recordings only”

1. **Backend:** Expose the homework-flow **student** endpoints, e.g.:
   - Start homework session (or reuse session with type=homework).
   - Get current warm-up task text for the student (admin has already chosen which one).
   - Submit recording_1 → get performance_score_1, context_short, task text (context_short + focus_task + metric_question_1 + metric_question_2).
   - Submit metric_question_1/2 answers → get final_task text.
   - Submit recording_2 → get performance_score_2.
   - Get/skip questions → get report (performance_score_end, etc.).

2. **Frontend:** **Done.** At `/dashboard`:
   - **Step 1:** Start homework → get warm_up_task text; show text + record button; on complete → upload recording_1.
   - **Step 2:** Show **task text**; student answers metric_question_1 and metric_question_2; submit → get final_task text.
   - **Step 3:** Show **final_task** text + record button; on complete → upload recording_2.
   - **Step 4:** GET questions; if any, show form and submit answers; if none, submit empty answers and get report.
   - **Step 5:** Show **report** (report_text, performance_score_end) and “Back to dashboard”.

BFF routes: `POST /api/homework/start`, `POST .../session/[id]/recording-1`, etc. (proxied to backend `/v2/homework/*`). Until the **backend** implements `/v2/homework/*`, the flow will show an error when starting or uploading.
