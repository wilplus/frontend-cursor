# What’s in place (frontend vs backend)

## Short answer

- **Admin:** Warm-up tasks, metric questions, students, overrides, exercises, tasks, post-questions, metrics, BFF routes — **in place.**
- **Student “homework” flow (warm_up + two recordings):** **Frontend in place** at `/dashboard/homework`. Steps: warm-up text + record → task text + metric answers → final task + record → questions (or skip) → report. **Backend** must expose the homework student endpoints (see “What’s needed” below); until then, starting homework will fail with a friendly error.

---

## Admin panel (in place)

- **Students:** List, profile, overrides, speaker profile, session history, Send Homework.
- **Warm-up tasks:** Per-student list; add, edit, delete. (Student does not see this yet — no student UI for it.)
- **Exercises, Tasks, Post-recording questions:** CRUD lists and modals.
- **Metric questions:** Two slots (position 1 and 2) on Metrics page; add, edit, delete.
- **Metric labels:** Get/put label pairs (e.g. left/right per metric).
- **BFF:** All admin calls go through `/api/v2/admin/*` with the admin token.

---

## Student app (current vs desired)

| | Current | What you want |
|---|--------|----------------|
| **First screen** | “Start session” → universal questions (mood, readiness, mode). | **Warm-up task text + record button only.** |
| **Flow** | Universal questions → (optional) exercise → task → intent → **one** recording → post-questions → report. | **Two recordings:** recording_1 (warm-up) → task text + metric answers → recording_2 → questions → report. |
| **In place?** | Yes (dashboard + v2 dashboard). | **Yes (frontend).** See `/dashboard/homework`. Backend endpoints still needed. |

The homework flow UI is at **`/dashboard/homework`**: warm-up task + record → task text + metric answers → final task + record → questions (or skip) → report. The backend does not yet expose the homework-flow student endpoints; when they are added, the same BFF routes and client will work.

---

## What’s needed for “warm_up + two recordings only”

1. **Backend:** Expose the homework-flow **student** endpoints, e.g.:
   - Start homework session (or reuse session with type=homework).
   - Get current warm-up task text for the student (admin has already chosen which one).
   - Submit recording_1 → get performance_score_1, context_short, task text (context_short + focus_task + metric_question_1 + metric_question_2).
   - Submit metric_question_1/2 answers → get final_task text.
   - Submit recording_2 → get performance_score_2.
   - Get/skip questions → get report (performance_score_end, etc.).

2. **Frontend:** **Done.** At `/dashboard/homework`:
   - **Step 1:** Start homework → get warm_up_task text; show text + record button; on complete → upload recording_1.
   - **Step 2:** Show **task text**; student answers metric_question_1 and metric_question_2; submit → get final_task text.
   - **Step 3:** Show **final_task** text + record button; on complete → upload recording_2.
   - **Step 4:** GET questions; if any, show form and submit answers; if none, submit empty answers and get report.
   - **Step 5:** Show **report** (report_text, performance_score_end) and “Back to dashboard”.

BFF routes: `POST /api/v2/homework/start`, `POST .../session/[id]/recording-1`, `POST .../metric-answers`, `POST .../recording-2`, `GET .../questions`, `POST .../post-answers`. Until the **backend** implements the corresponding `/v2/homework/*` endpoints, the flow will show an error when starting or uploading.
