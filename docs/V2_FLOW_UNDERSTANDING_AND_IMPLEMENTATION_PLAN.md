# V2 Flow — My Understanding & Implementation Plan

This doc states **how I understand** the v2 homework flow and **how I would implement it** (frontend + backend). Correct anything that’s wrong.

---

## Part 1: My understanding of the flow

### Step 1 — Warm-up and first recording

- **Student sees:** One **task_warm_up** text (exactly one; which one is decided by the admin).
- **Student does:** Records **recording_1**.
- **Backend:** Transcribes recording_1, computes **3 metrics** (strength, fillers, pacing), then **performance_score_1** (0–1, 0–100%). Formula TBD later.
- **Admin:** Has a **list of task_warm_up** items **per student**. Can add, edit, delete. **Admin decides which task_warm_up from the list is “allowed” / shown** for that homework run. The student only ever sees **one** task_warm_up per run (the one the admin selected).

---

### Step 2 — Task text (after recording_1)

- **Student sees:** A **task text** (one block) built from:
  - **context_short** — AI summary of recording_1 (backend).
  - **focus_task** — one task from the student’s focus_task list, chosen by backend using performance_score_1.
  - **metric_question_1** — text of first metric question (from admin Metrics).
  - **metric_question_2** — text of second metric question (from admin Metrics).
- **Student does:** Reads that text and **answers** metric_question_1 and metric_question_2 (two inputs).
- **Backend:**  
  - Extracts context_short from recording_1 (AI).  
  - Filters focus_task list: a focus_task is **eligible** when its **min_task_score ≤ performance_score_1** (and, if using a range, **performance_score_1 ≤ max_task_score**). Example: if performance_score_1 = 0.1, only tasks with min_task_score 0.1 or lower (e.g. 0.1, 0.05) are eligible; a task with min_task_score 0.2 is **not** eligible.  
  - If multiple eligible focus_tasks, picks one with **random.shuffle()**.  
  - Serves metric_question_1 and metric_question_2 from admin Metrics (two fixed questions).
- **Admin:**  
  - **focus_task** = list per student; each item has text + **Min Task Score** and **Max Task Score** (0–1), defining the score range for which the task is available. Can add/edit/delete.  
  - **Metrics** section: **two fixed questions** — metric_question_1 and metric_question_2; admin can edit/delete/add (the two slots).  
  - **Confirmed:** metric_question_1 and metric_question_2 are two fixed questions; 5 metrics for recording_2 = strength, fillers, pacing + metric_answer_1, metric_answer_2.

---

### Step 3 — Final task and second recording

- **Student sees:** **final_task** text = context (from recording_1) + focus_task (same as step 2) + metric_answer_1 + metric_answer_2 (their answers in step 2).
- **Student does:** Records **recording_2**.
- **Backend:** Transcribes recording_2, computes **5 metrics** (strength, fillers, pacing, metric_answer_1, metric_answer_2), then **performance_score_2** (0–1). Formula TBD later.
- **Admin:** No controls at this step.

**Confirmed:** The 5 metrics are strength, fillers, pacing + metric_answer_1, metric_answer_2. Exact meaning of metric_answer_1/2 in the 5 metrics to be defined when you specify scoring.

---

### Step 4 — Questions

- **Student sees:** A list of **questions** (from admin pool assigned to the student).
- **Student does:** Answers them (or step is skipped if none).
- **Backend:** Saves answers into a variable **questions** (e.g. array of { question_id, answer }).
- **Admin:** Chooses which questions are in the pool and which are assigned to which student (already have “post-recording questions” and per-student assignment). Can add/edit/delete questions. If zero questions assigned, this step is skipped.

**Clarification I’m assuming:** These are the same “post-recording questions” you already have in the admin (Questions tab + student homework config), and “if no questions added this step is skipped” means: if the admin assigns 0 questions to that student, we don’t show the questions step at all.

---

### Step 5 — Report

- **Student sees:** A **report** = context_short + **performance_score_end** + answers to **questions**. performance_score_end = (performance_score_1 + performance_score_2) / 2. Report is AI-generated.
- **Backend:** Generates report using context_short, performance_score_end, and the **questions** answers; stores it; exposes it to admin as the “report” for this homework/session.
- **Admin:** Can view, delete, edit, overwrite the report. The (final) report is stored in **context_long** (long-term context for that student). So context_long is updated with this report when homework is done.

**Confirmed:** **context_long** = append with **timestamps** so you have a full history of observations. If it gets too long, it can be summarized later with AI. So each new report is appended (with a timestamp), not replace.

---

### Step 6 — After report (history and re-send)

- **Student:** Flow is finished.
- **Backend:** Report is sent to admin (e.g. stored in session/history); context_long is updated.
- **Admin:** Sees the report in **history** (e.g. in the student’s session/history tab). Can change task_warm_up list, focus_task list, metric questions, questions assignment, etc., and **re-send homework** to the student (student gets a new “run” with the same flow but updated content).

**Confirmed:** Re-send = new homework/session with updated parameters; student goes through steps 1–5 again. **Dashboard:** **Replace** the current v2 flow (universal_questions → one recording → post_questions) with this new two-recording homework flow.

---

## Part 2: How I would implement it

I’d keep **performance_score_1**, **performance_score_2**, and **performance_score_end** as **placeholders** (e.g. 0.5 or a simple average) until you define the formulas. Below is the structural implementation.

---

### Backend (Flask + DB)

1. **Session / homework model**
   - One “homework” or “session” = one run through the flow (steps 1–5).
   - Store: student/user_id, status (e.g. warm_up, task_text, final_task, questions, report_done), recording_1_id, recording_2_id, performance_score_1, performance_score_2, context_short, chosen_focus_task_id, metric_answer_1, metric_answer_2, question_answers (JSON or table), report_text, timestamps.

2. **task_warm_up**
   - Table (or JSON per student): e.g. `student_task_warm_ups` with (user_id, id, text, order). Admin CRUD. **Admin selects which one is “allowed” / shown** for the current homework (e.g. a designated “active” or “selected” id per student per homework, or per run). When student starts step 1, backend returns that **one** task_warm_up text.

3. **focus_task**
   - Table: e.g. `student_focus_tasks` with (user_id, id, title, prompt_text, **min_task_score** 0–1, **max_task_score** 0–1). Admin CRUD (UI: Min Task Score and Max Task Score inputs as in the admin screenshot). After recording_1, backend: compute performance_score_1 (placeholder), filter focus_tasks where **min_task_score ≤ performance_score_1** (and optionally **performance_score_1 ≤ max_task_score**), shuffle and pick one, return task text + context_short + metric_question_1/2.

4. **Metrics: metric_question_1 and metric_question_2**
   - Either two fixed rows in a “metrics” or “metric_questions” table (codes `metric_question_1`, `metric_question_2`) with editable text, or two config fields. Admin edits in Metrics section. Backend reads them when building the task text.

5. **Recording_1**
   - Upload endpoint (e.g. same as current upload but tagged as “recording_1” for this session). Transcribe, compute 3 metrics (strength, fillers, pacing), store; compute performance_score_1 (placeholder); extract context_short (AI). Return context_short + performance_score_1 + next step payload (task text with focus_task + metric_question_1/2).

6. **Task text + metric answers**
   - Endpoint: submit metric_answer_1 and metric_answer_2. Backend builds final_task = context + focus_task + metric_answer_1 + metric_answer_2 (e.g. via prompt), stores answers, returns final_task text for the student to read before recording_2.

7. **Recording_2**
   - Upload endpoint (tagged “recording_2”). Transcribe, compute 5 metrics (strength, fillers, pacing, metric_answer_1, metric_answer_2), store; compute performance_score_2 (placeholder). Return next step: questions (if any) or report.

8. **Questions**
   - Use existing post-recording questions: get assigned question IDs for student, return them; submit answers; store in “questions” (e.g. session_question_answers). If none assigned, skip and go to report.

9. **Report**
   - performance_score_end = (performance_score_1 + performance_score_2) / 2. Generate report (AI) from context_short, performance_score_end, question answers. Store report on session; **append** report to **context_long** **with timestamp** (full history; can summarize with AI later if too long). Return report to frontend; expose to admin in history.

10. **Admin**
   - **History:** List sessions/homeworks per student; show report, performance_score_1/2/end, recordings. Allow delete/edit/overwrite report (update stored report and optionally context_long).
   - **Re-send:** Create new session/homework for student with current task_warm_up, focus_task, and question assignments; student sees “new homework” and goes through steps 1–5 again.

11. **BFF / auth**
   - Existing `/api/v2/*` and admin BFF; add any new backend routes under `/v2/` (student) and `/v2/admin/` (admin). Auth as today (Supabase JWT; admin check for admin routes).

---

### Frontend (Next.js)

1. **Student flow (new v2 homework flow)**
   - **States:** e.g. `warm_up` → `recording_1` → `task_text` (show task + collect metric_question_1/2 answers) → `final_task` (show final task text) → `recording_2` → `questions` (or skip) → `report` → `completed`.
   - **Store:** New store or extend v2 store: session_id, step, task_warm_up_text, recording_1_id, task_text (context_short + focus_task + metric_question_1/2), metric_answers, final_task_text, recording_2_id, question_answers, report, performance_score_1/2/end (for display). Call new backend endpoints for each step.
   - **UI:** One screen per step: (1) show task_warm_up, start recording, upload recording_1; (2) show task text, two inputs for metric_question_1/2, submit; (3) show final_task, start recording, upload recording_2; (4) show questions form if any, else skip; (5) show report; (6) done. Progress indicator (e.g. steps 1–5).

2. **Dashboard entry**
   - **Replace** the current v2 flow with this new homework flow. Single “Start homework” (or equivalent) that runs: warm_up → recording_1 → task_text → final_task → recording_2 → questions → report. No separate “old” v2 session card.

3. **Admin: task_warm_up**
   - On student profile: section “Task warm-up” with list of items (text); add / edit / delete; save via new API (e.g. PUT `/v2/admin/students/:id/task-warm-ups` or inside overrides).

4. **Admin: focus_task**
   - On student profile: section “Focus tasks” with list; each item has **Min Task Score** and **Max Task Score** (0–1) inputs as in the uploaded screenshot, plus title/prompt text. Add / edit / delete; save via new API. Used in the “task text” step; eligibility = min_task_score ≤ performance_score_1 (and optionally within [min, max]).

5. **Admin: Metrics**
   - In Metrics section: two fields (or two rows) for “Metric question 1” and “Metric question 2” text; save with existing metrics API or new one. Backend reads these when building the task text.

6. **Admin: Report and history**
   - In student session/history: show report; allow edit/overwrite (textarea + save). “Re-send homework” button creates new homework run with current config.

7. **Questions**
   - Reuse existing Questions tab and student “post-recording questions” assignment; if backend returns 0 questions for step 4, frontend skips to report.

---

### Data flow summary (backend ↔ frontend)

- **Start homework** → POST start session → backend returns task_warm_up text.
- **After recording_1** → POST upload recording_1 → backend returns task text (context_short + focus_task + metric_question_1/2).
- **After metric answers** → POST submit metric_question_1/2 answers → backend returns final_task text.
- **After recording_2** → POST upload recording_2 → backend returns either questions (if any) or report.
- **After questions (or skip)** → if questions: POST submit question answers → backend returns report; if skip: GET report or same.
- **Report** → GET report (or in response above); display; backend has already stored report and updated context_long.

---

## Part 3: What I’d leave for you to define later

- **Exact formulas** for performance_score_1 (from 3 metrics) and performance_score_2 (from 5 metrics). I’d use e.g. simple average (0–1) as placeholder until you specify.
- **Meaning of “metric_answer_1” and “metric_answer_2” in the 5 metrics** (how recording_2 is scored against the two answers).
- **context_long** format: **append with timestamps**; full history; summarize with AI later if too long. **Confirmed.**
- **task_warm_up:** Admin chooses which one from the list is shown; student sees exactly one. **Confirmed.**
- **focus_task eligibility:** focus_task is eligible when **min_task_score ≤ performance_score_1** (e.g. if performance_score_1 = 0.1, tasks with 0.1 or 0.05 are ok, 0.2 is not). Each task has Min Task Score and Max Task Score (as in admin UI). **Confirmed.**

---

## Part 4: Summary

| Step | Student | Backend | Admin |
|------|--------|---------|--------|
| 1 | See task_warm_up; record recording_1 | 3 metrics → performance_score_1; context_short (AI) | task_warm_up list CRUD (per student) |
| 2 | See task text; answer metric_question_1/2 | Pick focus_task by performance_score_1 (shuffle if >1); serve metric Qs | focus_task list CRUD; Metrics: metric_question_1/2 text |
| 3 | See final_task; record recording_2 | 5 metrics → performance_score_2 | — |
| 4 | Answer questions (or skip) | Save to “questions” | Choose questions; skip if 0 |
| 5 | See report | performance_score_end; AI report; store; context_long | View/edit/overwrite report |
| 6 | Done | History; context_long updated | History; re-send homework |

If anything above is wrong or you want different naming (e.g. “session” vs “homework”, “task_warm_up” as one vs list), say how you’d like it and I’ll align the implementation plan to that.
