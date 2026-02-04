# Flow & Scoring Overview — What’s in Place, Student Flow, Admin Flow, Background, Scores

This doc answers: **what is in place**, **student flow**, **admin flow**, **what happens in the background**, and **how the three performance scores are (or will be) calculated**.

---

## 1. What is in place

### Frontend (this repo)

| Area | In place | Notes |
|------|----------|--------|
| **Student dashboard** | ✅ | `/dashboard` with v1 `SessionCard` and v2 `SessionCardV2`. |
| **V2 student flow (current)** | ✅ | `session-store-v2-flow.ts`: **universal_questions → exercise → task → intent → recording → post_questions → completed**. Single recording, one `performance_score`, 5 metrics. Uses `v2Api` and `/api/v2/*`. |
| **V2 homework flow (new spec)** | ❌ Not implemented | The flow in `V2_HOMEWORK_FLOW_SPEC.md` (task_warm_up → recording_1 → 3 metrics → task text → final task → recording_2 → 5 metrics → questions → report) is **not** in the frontend yet. No `task_warm_up`, `focus_task`, `context_short`, `recording_1`/`recording_2` in code. |
| **Admin panel** | ✅ | `/admin` with: Students, Exercises, Tasks, Questions, Metrics, Recordings. Layout + auth (Supabase), BFF under `/api/v2/admin/*`. |
| **Admin – Students** | ✅ | List, search, student profile with homework config (exercises, tasks, post-questions, overrides, speaker profile), session history, Send Homework. |
| **Admin – Exercises / Tasks / Questions** | ✅ | CRUD lists + add/edit/delete modals; BFF proxies to backend. |
| **Admin – Metrics** | ✅ | Get/put metric label pairs (e.g. left/right labels per metric). |
| **Admin – Recordings** | ✅ | Recordings list (existing flow). |
| **Admin – task_warm_up / focus_task (per spec)** | ❌ Not implemented | Spec says admin can edit “task_warm_up” list and “focus_task” list per student; no UI or API for these yet. |

### Backend

- Described in `BACKEND_ADMIN_API_PROMPT.md` and `V2_MAJOR_FLOW_PROMPTS.md`. Implementation lives in the backend repo (Flask + Supabase).
- Current v2 backend supports: session start/status, universal questions, exercise/task selection, one recording upload, 5 metrics, post-questions, report. It does **not** yet implement the two-recording flow (recording_1 → performance_score_1 → task text → recording_2 → performance_score_2) or `task_warm_up` / `focus_task` as in the spec.

### Docs (this repo)

- **`V2_HOMEWORK_FLOW_SPEC.md`** — Target flow: task_warm_up, recording_1, performance_score_1, AI task text, final task, recording_2, performance_score_2, questions, report, context_long, history. Single source of truth for **flow** and **admin vs backend**; score **formulas** are deferred.
- **`V2_MAJOR_FLOW_PROMPTS.md`** — Older v2 prompts (single recording, 5 metrics, one performance_score).
- **`BACKEND_ADMIN_API_PROMPT.md`** — Admin API contract and troubleshooting.

---

## 2. Student / user flow

### A) Target flow (from `V2_HOMEWORK_FLOW_SPEC.md`) — not yet built

1. **Task warm-up** — User sees **task_warm_up** text (from admin list), then records **recording_1**. Backend measures **3 metrics**: strength, fillers, pacing, and computes **performance_score_1** (0–1).
2. **AI task text** — User sees text: **context_short** (AI from recording_1) + **focus_task** (chosen by performance_score_1) + **metric_question_1** + **metric_question_2** (from admin Metrics). User answers metric_question_1 and metric_question_2.
3. **Final task + recording_2** — User sees **final_task**: context + focus_task + metric_answer_1 + metric_answer_2, then records **recording_2**. Backend measures **5 metrics** (strength, fillers, pacing, metric_answer_1, metric_answer_2) and computes **performance_score_2** (0–1).
4. **Questions** — User answers admin-configured questions (or step skipped if none).
5. **Report** — User sees report: **context_short**, **performance_score_end** = (performance_score_1 + performance_score_2) / 2, and question answers. Report is AI-generated; stored in **context_long**; sent to admin history.
6. **Done** — Homework finished; admin can update parameters and re-send homework.

### B) Current flow (implemented in frontend)

- **V2 flow** (`session-store-v2-flow.ts`): **universal_questions** → **exercise** (optional) → **task** (1 or 3 options) → **intent** (emotion, keywords) → **recording** (one) → **post_questions** (exactly 3) → **completed** (report + performance_score).
- One recording per session; one **performance_score** and 5 metrics (pace, strength, fillers, emotion_achieved, keywords_used) from `V2_MAJOR_FLOW_PROMPTS.md`. No recording_1/recording_2, no performance_score_1/2/end, no task_warm_up or focus_task in the UI.

---

## 3. Admin flow

### What exists today

- **Students** — List with search; open student → profile with:
  - Homework config: show_exercise_step, next exercise (single), tasks (multi), post-recording questions (exactly 3), prompt overrides (intended_emotion, keywords, emotion_check).
  - Speaker profile (goals, motivation, notes, etc.).
  - Session history (sessions with task_score, performance_score_v2, report/transcript preview).
  - “Send Homework”.
- **Exercises** — List, add/edit/delete (library).
- **Tasks** — List, add/edit/delete (library).
- **Questions** — List, add/edit/delete post-recording questions (library).
- **Metrics** — Get/put metric label pairs (e.g. “Too slow” / “Too fast”).
- **Recordings** — List of recordings (existing flow).

All admin API calls go through the Next.js BFF (`/api/v2/admin/*`), which proxies to the backend with the admin’s Supabase token.

### What the spec adds (not yet in UI/API)

- **task_warm_up** — Per-student list; admin can edit/update/delete (no UI yet).
- **focus_task** — Per-student list with score thresholds; admin can edit/update/delete (no UI yet).
- **metric_question_1 / metric_question_2** — In Metrics section; admin can add/edit/delete (Metrics UI exists for label pairs; metric “questions” for the task text are not yet distinct).
- **Report** — Admin can delete/edit/overwrite report; report stored in **context_long** (report editing/context_long may exist in backend only; confirm in backend repo).

---

## 4. What happens in the background

### Current v2 flow (one recording)

1. Student starts session → backend creates session, returns universal questions.
2. Student submits universal answers → backend returns plan (exercise if any, task(s)).
3. Student selects task (or gets single task) and intent → frontend shows recording UI.
4. Student records → frontend uploads audio; backend transcribes, computes 5 metrics and **performance_score**, stores recording.
5. Backend returns post-recording questions (e.g. 3); student submits answers → backend finalizes metrics/score if needed, generates report, stores report.
6. Frontend shows completed state with report and performance score (and may cache in localStorage).

### Target flow (two recordings, from spec)

1. Backend serves **task_warm_up** for the student → student records **recording_1** → backend transcribes, computes **3 metrics** (strength, fillers, pacing) → **performance_score_1**.
2. Backend extracts **context_short** from recording_1; selects **focus_task** using performance_score_1 (and random if >1 eligible); gets **metric_question_1/2** from Metrics → student sees task text and answers metric questions.
3. Backend builds **final_task** (context + focus_task + metric answers) → student records **recording_2** → backend computes **5 metrics** → **performance_score_2**.
4. Backend (or frontend) shows admin-configured **questions** (or skips); answers saved.
5. Backend computes **performance_score_end** = (performance_score_1 + performance_score_2) / 2; generates **report** (context_short, performance_score_end, question answers); stores report in **context_long**; report sent to admin history.
6. Admin sees report in history; can update task_warm_up, focus_task, metrics, questions, etc., and re-send homework.

---

## 5. How each of the three performance scores is calculated

The **target** flow uses three scores. Their **exact formulas are not yet defined** in the codebase; they are deferred in `V2_HOMEWORK_FLOW_SPEC.md`. Below is what is **specified or implied** (no implementation detail).

### performance_score_1

- **Inputs:** One recording (**recording_1**) and **3 metrics**: strength, fillers, pacing.
- **Output:** A single number on a scale **0 to 1** (0%–100%).
- **Status:** **Formula TBD.** The spec only states it is “calculated from the 3 metrics”; no formula (e.g. average, weighted average, or smoothing) is given. To be defined when you focus on scoring.

### performance_score_2

- **Inputs:** One recording (**recording_2**) and **5 metrics**: strength, fillers, pacing, metric_answer_1, metric_answer_2.
- **Output:** A single number on a scale **0 to 1** (0%–100%).
- **Status:** **Formula TBD.** Same as above; “calculated from the 5 metrics” with no formula yet.

### performance_score_end

- **Definition (spec):**  
  **performance_score_end = (performance_score_1 + performance_score_2) / 2**
- **Use:** Fed into the **report** (with context_short and question answers); report is AI-generated and stored in **context_long**; also shown to admin in history.
- **Status:** Only the **definition** is set (average of the two scores). Any extra rules (e.g. weighting, caps) are TBD.

### Reference: current v2 single score (existing backend prompt)

In `V2_MAJOR_FLOW_PROMPTS.md`, the **existing** (single-recording) v2 flow uses one **performance_score** and 5 metrics (pace, strength, fillers, emotion_achieved, keywords_used):

- Per-metric score 0..1; easing/smoothing (e.g. smoothstep/logistic) for continuous metrics.
- **performance_score** = average of the 5 metric scores (or weighted average with code constants).
- Full breakdown (raw values, normalized score, explanation) stored.

That formula applies to the **current** one-recording flow only. It is **not** the same as performance_score_1, performance_score_2, or performance_score_end in the new two-recording spec.

---

## Quick reference

| Topic | Where it’s defined / implemented |
|-------|----------------------------------|
| Target student flow (two recordings) | `docs/V2_HOMEWORK_FLOW_SPEC.md` |
| Current student flow (one recording) | `src/store/session-store-v2-flow.ts`, `SessionCardV2` |
| Admin UI and BFF | `src/app/admin/*`, `src/app/api/v2/admin/*`, `src/lib/api/admin-client.ts` |
| Admin API contract | `docs/BACKEND_ADMIN_API_PROMPT.md` |
| Old v2 scoring (5 metrics, one score) | `docs/V2_MAJOR_FLOW_PROMPTS.md` (B) SCORING + METRICS |
| performance_score_1 / _2 / _end formulas | **Deferred**; to be specified later (see `V2_HOMEWORK_FLOW_SPEC.md` “Deferred” section). |
