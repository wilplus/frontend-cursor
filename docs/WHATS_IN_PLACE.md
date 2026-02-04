# What’s in place (frontend vs backend)

## Short answer

- **Admin:** Warm-up tasks, metric questions, students, overrides, exercises, tasks, post-questions, metrics, BFF routes — **in place.**
- **Student “homework” flow (warm_up text + record button, then two recordings):** **Not in place.** The student app still uses the **old** flow (universal questions → exercise → task → **one** recording → post-questions). There is no student screen that shows only the warm-up task text + record button and the two-recording flow.

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
| **In place?** | Yes (dashboard + v2 dashboard). | **No.** |

So: the flow where the user **first** sees the warm_up_task text and a record button, and then does the **two-recording** flow with nothing else, is **not** implemented in the frontend (and the backend does not yet expose the homework-flow student endpoints, per the sync doc).

---

## What’s needed for “warm_up + two recordings only”

1. **Backend:** Expose the homework-flow **student** endpoints, e.g.:
   - Start homework session (or reuse session with type=homework).
   - Get current warm-up task text for the student (admin has already chosen which one).
   - Submit recording_1 → get performance_score_1, context_short, task text (context_short + focus_task + metric_question_1 + metric_question_2).
   - Submit metric_question_1/2 answers → get final_task text.
   - Submit recording_2 → get performance_score_2.
   - Get/skip questions → get report (performance_score_end, etc.).

2. **Frontend:** Replace (or add a dedicated path for) the current student flow with:
   - **Step 1:** Load and show the **warm_up_task** text and a **record** button; on submit → upload recording_1.
   - **Step 2:** Show **task text** (context_short + focus_task + metric_question_1 + metric_question_2); student answers the two metric questions.
   - **Step 3:** Show **final_task** text and a **record** button; on submit → upload recording_2.
   - **Step 4:** Show **questions** (or skip if none).
   - **Step 5:** Show **report**.

Until both backend and frontend implement the above, the “first screen = warm_up text + record button, then two recordings only” flow is **not** in place.
