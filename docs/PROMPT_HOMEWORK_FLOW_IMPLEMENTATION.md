# Prompt for LLM: Implement Full Homework Flow (Variables, Gaps, Plan)

Use this document to implement the complete homework flow. It lists **all variables**, what is **already implemented** vs **missing**, and **explicit questions** the implementing LLM must get answered before or during implementation.

---

## 1. Intended flow (summary)

1. **warmup_task** → user records **recording_1** → transcription gives **context_1** → **n_metrics** (hardcoded) score **recording_1** → **score_1** (performance_score_1).
2. **Focus task** is chosen: only tasks whose **max_performance_score** (or equivalent) is **≥ score_1** (e.g. user scores 0.5 → only focus_tasks with score ≤ 0.5).
3. User answers **metric_questions**; answers are stored.
4. **AI generates the task** from: **context_1** + **metric_question answers** + **chosen focus_task** (framework for this generation is **TBD — need help**).
5. User sees the generated task, records **recording_2** → transcription → **context_2** → **n_metrics** score **recording_2** → **score_2** (performance_score_2).
6. **score_transcription** is generated from transcript + metric_question answers (**how to calculate — need help**).
7. **after_recording_questions** (post-recording questions) are asked; answers stored.
8. Stored for report: **context_2**, **score_2**, **score_transcription**, **answers to after_recording_questions**.
9. **report_history** is generated with **score_end** (**how to calculate — need help**) and **context_end** (coach-like report from context, post-recording answers, and score).
10. Report is sent to **admin**; admin adjusts scoring, warmup_task, focus_task, post_recording_questions, and **student_context** (student bio for coach). Updated params are sent to the user; **warmup_task selection is influenced** by this (e.g. via last score / student context).

---

## 2. What is ALREADY implemented (frontend + BFF)

### 2.1 Admin panel (student profile)

| Variable / feature | Implemented | Where |
|--------------------|-------------|--------|
| **task_warm_up** (warm-up tasks) | ✅ | Per-student list: + Add, Manage list (pool sync), Edit, Delete. `max_performance_score` per task. API: `task-warm-up`, `task-warm-up-pool`, keys `task_warm_up`, `task_warm_up_pool`. |
| **focus_task** (focus tasks) | ✅ | Per-student list: + Add, Manage list, Edit, Delete. `max_performance_score` per task. API: `task-focus`, `task-focus-pool`, keys `task_focus`, `task_focus_pool`. |
| **post_recording_questions** (after_recording_questions) | ✅ | Per-student list + pool: + Add, Manage list, Edit, Delete. API: `post-recording-questions`, `post-recording-questions-pool`, keys `post_recording_questions`, `post_recording_questions_pool`. |
| **metric_questions** | ✅ | 3 slots in Metrics section: `metric_question_1`, `metric_question_2`, `metric_question_3`. Stored per user via `getUserMetricQuestions` / `patchUserMetricQuestions`. |
| **student_context** (coach-only bio) | ✅ | Speaker Profile → "Context" textarea; saved as `speaker_profile.coach_notes` (and other fields: main_goal, motivation, etc.). API: `putSpeakerProfile`. |
| **Report history** (list) | ✅ | "Reports History" shows `sessions[].report_preview.report_text_preview` and `created_at`. No edit/overwrite in UI. |
| **Send Homework** | ✅ | `adminApi.sendAssignment(id)`. |

### 2.2 Homework flow (student) — UI and API calls

| Step | Implemented | Where |
|------|-------------|--------|
| Start session, get warm_up_task text | ✅ | `POST /api/homework/session/start` → `warm_up_task_text`. BFF proxies to backend or returns mock. |
| Show warm-up, record recording_1 | ✅ | `HomeworkFlowCard`: step 1 shows warm-up text + `AudioRecorder`; upload via `POST .../session/:id/recording-1`. |
| After recording_1: task block + metric questions | ✅ | Expects `performance_score_1`, `task_block` (context_short, focus_task, metric_question_1/2/3). `POST .../recording-1` returns these; UI shows task text and 3 metric inputs. |
| Submit metric answers, get final_task | ✅ | `POST .../session/:id/metric-answers` with `metric_answer_1`, `metric_answer_2`, `metric_answer_3`; response has `final_task` / `final_task_text`. |
| Show final task, record recording_2 | ✅ | Step 3: display final task text, upload via `POST .../session/:id/recording-2`. |
| Post-recording questions | ✅ | `GET .../session/:id/questions`; if non-empty, show form; submit `POST .../post-answers` with `answers[]`. |
| Report | ✅ | After post-answers, response has `report_text`, `performance_score_end`; UI displays them. |

### 2.3 Types and API contracts (existing)

| Item | Implemented | Where |
|------|-------------|--------|
| Homework session start response | ✅ | `session_id`, `warm_up_task_text` (`types-homework.ts`, BFF normalizes `warm_up_task` → `warm_up_task_text`). |
| Recording_1 response | ✅ | `HomeworkRecording1Response`: `performance_score_1`, `task_block` (context_short, focus_task, metric_question_1/2/3), task_text. |
| Metric answers request/response | ✅ | Body: `metric_answer_1`, `metric_answer_2`, `metric_answer_3`. Response: `final_task` / `final_task_text`. |
| Recording_2 response | ✅ | `performance_score_2`. |
| Post-answers → report | ✅ | `report_text`, `performance_score_end`. |
| Warm-up selection rule (backend spec) | ✅ | `WARM_UP_SELECTION_SPEC.md`: eligible where `max_performance_score >= last performance_score_end`; ±3%; random if multiple; first-time = easiest; fallback = hardest. |
| Focus task selection rule (docs) | ✅ | Eligible when `min_task_score ≤ performance_score_1` (or max_performance_score ≤ score_1 depending on product); random if >1. |

### 2.4 Backend / BFF (partially)

| Item | Status |
|------|--------|
| BFF routes for homework | ✅ | `/api/homework/session/start`, `.../session/[sessionId]/recording-1`, `recording-2`, `metric-answers`, `task-block`, `questions`, `post-answers`. Can proxy to backend or use mock. |
| Backend implementation of full flow | ❓ | Unknown from frontend repo. Docs say formulas for score_1, score_2, score_end are **TBD**. Backend may or may not implement recording_1 → context_short, focus selection, final_task generation, recording_2, report. |

---

## 3. What is NOT implemented or needs definition

### 3.1 Naming alignment (your flow ↔ codebase)

| Your term | In codebase / spec | Note |
|-----------|--------------------|------|
| context_1 | context_short | From recording_1 transcription/summary. ✅ Used in types and docs. |
| context_2 | — | Not named in spec. You want transcription/summary of recording_2 stored; used for report. **Clarify:** Is context_2 the raw transcript of recording_2 or an AI summary? |
| score_1 | performance_score_1 | ✅ |
| score_2 | performance_score_2 | ✅ |
| score_end | performance_score_end | Spec: `(performance_score_1 + performance_score_2) / 2`. **You said you need help** with how to calculate it. |
| score_transcription | — | **Not in current spec.** You said: "transcribed text is analysed based on the transcript and metric_question answers and score_transcription is generated" — **need formula/spec.** |
| context_end | report text / coach report | In spec: AI-generated report from context_short, performance_score_end, question answers. Stored in history; admin sees it. **Not explicitly named "context_end"** but same idea. |
| after_recording_questions | post_recording_questions | ✅ Same. |
| student_context | speaker_profile (e.g. coach_notes) | ✅ Admin "Context" textarea; used as student bio for coach. |
| n_metrics | 3 for recording_1, 5 for recording_2 | Spec says 3 (e.g. strength, fillers, pacing) then 5 (+ metric_answer_1, metric_answer_2). **You said hardcoded** — confirm if n is fixed or configurable later. |

### 3.2 Missing or TBD (implementation / product)

| Gap | Description |
|-----|-------------|
| **AI task generation framework** | After recording_1: combine **context_1** (context_short) + **metric_question answers** + **chosen focus_task** to generate the text the user sees before recording_2. **Exact prompt, model, and structure are not defined** — you said you need help here. |
| **score_transcription** | How to compute a score from the **transcript of recording_2** and the **metric_question answers**. Not in current spec — need formula or rule. |
| **score_end** | Spec currently: `(performance_score_1 + performance_score_2) / 2`. You said you need help — confirm if weighted, or include score_transcription, or other rule. |
| **context_2 storage and use** | Recording_2 is transcribed; that text (or a summary) must be stored and fed into the report. **Not explicitly in frontend types**; backend must store and use it. |
| **Report content spec** | Report (context_end) should be "coach-like, referring to context, post-recording answers, and score". Current docs say: context_short, performance_score_end, question answers. **Confirm:** Should report use **context_2** (recording_2) as well, or only context_1 (context_short)? |
| **Admin report edit/overwrite** | Admin can "adjust scoring, add/delete/edit warmup_task, focus_task, post_recording_questions, student_context". **Editing the report text itself** or **overwriting context_long** is mentioned in docs but **not implemented in admin UI**. |
| **How warmup_task is "influenced" by admin** | Warm-up is chosen by **last performance_score_end** and task **max_performance_score**. Student_context / coach_notes are not in the current warm-up selection spec. **Clarify:** Should student_context (or other admin edits) influence which warm-up is chosen, and how? |

---

## 4. Explicit questions for the other LLM (or product) to answer

Before or during implementation, get clear answers to:

1. **AI task generation (final task text)**  
   - Inputs: context_1 (context_short), chosen focus_task text, metric_question_1/2/3 texts, metric_answer_1/2/3.  
   - Output: Short instruction (e.g. two sentences) for the user before recording_2.  
   - **Question:** What is the exact prompt template, model, and max length? Should it say "Focus especially on [answer_1] and [answer_2]" or follow another structure?

2. **score_transcription**  
   - **Question:** How is score_transcription calculated? (e.g. similarity between transcript and metric answers, rubric, LLM grade, or formula?) What is its scale (0–1)? Is it stored and shown to admin/student?

3. **score_end (performance_score_end)**  
   - **Question:** Keep `(performance_score_1 + performance_score_2) / 2`, or add score_transcription, or use a different formula (e.g. weighted average)? What are the exact inputs and formula?

4. **context_2**  
   - **Question:** Is context_2 the raw transcript of recording_2 or an AI summary? Where is it stored (session table, report, context_long)? Should the report (context_end) use both context_1 and context_2?

5. **Report (context_end) content**  
   - **Question:** Should the coach report explicitly reference: (a) context_1 only, (b) context_2 only, (c) both, (d) post-recording question answers, (e) score_end, (f) score_transcription? Any required sections or tone?

6. **n_metrics**  
   - **Question:** Confirm: 3 metrics for recording_1 (e.g. strength, fillers, pacing) and 5 for recording_2 (those 3 + metric_answer_1, metric_answer_2)? Are the metric names and weights fixed or configurable later?

7. **Focus task eligibility**  
   - **Question:** Rule: "user scores 0.5 → only focus_tasks with score ≤ 0.5". So eligible when **max_performance_score ≤ score_1**? (Current docs sometimes say min_task_score ≤ score_1; confirm which field and inequality.)

8. **Admin: report edit and context_long**  
   - **Question:** Should admin be able to edit/overwrite the report text and/or append to context_long from the UI? If yes, which endpoints and UI (e.g. "Edit report" on each history item)?

9. **Warm-up influenced by admin**  
   - **Question:** Besides last performance_score_end and task max_performance_score, should student_context (or other admin-set fields) influence warm-up selection? If yes, how (e.g. prompt to LLM, or a separate rule)?

---

## 5. Implementation plan (high level)

1. **Backend**  
   - Implement or confirm: session start (warm-up selection from last score + max_performance_score), recording_1 upload → transcribe → context_1 (context_short) + 3 metrics → score_1; focus task selection (eligible by score_1); metric answers storage; **AI final task generation** (once framework is defined); recording_2 upload → transcribe → context_2 + 5 metrics → score_2; **score_transcription** (once formula is defined); post-recording answers; **score_end** (once formula is defined); **report generation** (context_end) using context_1, context_2 (if yes), scores, answers; persist report and append to context_long; expose history to admin.

2. **Frontend (student)**  
   - Already in place: start, recording_1, task block + metric questions, metric answers, final task, recording_2, questions, post-answers, report. **Add if backend returns them:** display context_2, score_transcription (if shown to user), and any new fields in report.

3. **Frontend (admin)**  
   - Already in place: warm-up/focus/post-recording lists, metric questions, student_context (Context textarea), report history list, Send Homework. **Add if required:** edit/overwrite report per session; UI to influence warm-up selection (if product rule is defined).

4. **Docs**  
   - Update `V2_HOMEWORK_FLOW_SPEC.md` (or equivalent) with: score_transcription definition, score_end formula, context_2 storage, report content spec, and AI task generation framework once decided.

---

## 6. Checklist for the implementing LLM

- [ ] Get answers to all questions in **Section 4** (from product or another LLM).
- [ ] Implement or wire **AI task generation** (final task text) per the chosen framework.
- [ ] Implement **score_transcription** (formula or rule) and storage.
- [ ] Implement **score_end** (formula) and ensure report uses it.
- [ ] Define **context_2** (transcript vs summary), storage, and use in report.
- [ ] Implement **report (context_end)** content and tone per spec.
- [ ] Confirm **n_metrics** (3 and 5) and focus eligibility rule (max_performance_score vs min_task_score, inequality).
- [ ] Add **admin report edit/overwrite** and **context_long** updates if required.
- [ ] If **student_context** influences warm-up, add the rule and any backend/frontend changes.
- [ ] Update frontend types and UI if backend adds new fields (context_2, score_transcription, etc.).

---

## 7. Key file references (this repo)

| Purpose | Path |
|--------|------|
| Homework flow UI | `src/components/homework/HomeworkFlowCard.tsx` |
| Homework API client | `src/lib/api/homework-client.ts` |
| Homework types | `src/lib/api/types-homework.ts` |
| BFF homework routes | `src/app/api/homework/session/` (start, [sessionId]/recording-1, recording-2, metric-answers, task-block, questions, post-answers) |
| Admin student profile | `src/app/admin/students/[id]/page.tsx` |
| Admin API client | `src/lib/api/admin-client.ts` |
| Flow/spec docs | `docs/V2_HOMEWORK_FLOW_SPEC.md`, `docs/FLOW_AND_SCORING_OVERVIEW.md`, `docs/WARM_UP_SELECTION_SPEC.md`, `docs/HOMEWORK_FLOW_TECHNICAL_MAP.md` |

Use this document as the single prompt/spec for implementing the full flow and for asking the explicit questions above.
