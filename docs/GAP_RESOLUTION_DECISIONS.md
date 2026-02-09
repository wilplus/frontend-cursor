# Gap resolution: answers, backend ownership, and questions for you

This document goes through the 12 gap categories and the 6 “must-define” items. For each: what we can **answer** from the codebase/docs, what is **backend/state to define**, and what we need **you** to decide.

---

## 1) Entity & ID model (Session, versioning)

### Answered from codebase

- **Session container:** The frontend already has a **session**: `POST /api/homework/session/start` returns `session_id`; all subsequent steps use `session_id` (recording-1, recording-2, metric-answers, questions, post-answers). So one “attempt” = one session identified by `session_id`. The backend is expected to tie together warmup, recordings, scores, focus_task, generated task, Q&A, and report for that `session_id`.
- **warmup_task vs focus_task vs AI task:**
  - **warmup_task** and **focus_task** are **admin-managed items** (templates): per-student lists with text and `max_performance_score`. The backend **selects one** warmup at session start and **one** focus_task after recording_1.
  - The **AI-generated task** is the **final_task** text shown before recording_2: it is **generated once per session** from context_1 + focus_task + metric answers. It is not a stored “task” entity with an ID in the admin list; it’s session-scoped output.

### Backend / state to define

- **Canonical schema for Session/Attempt:** Backend should define one “homework session” (or “attempt”) entity/table that stores at least: `session_id`, `user_id`, `warmup_task_id` (or snapshot), `recording_1_id`, `context_1` (or context_short), `score_1`, `focus_task_id` (or snapshot), `final_task_text`, `recording_2_id`, `context_2`, `score_2`, `score_transcription` (if used), post_question_answers, `score_end`, `report_text`/report_id, timestamps, status. This is **backend schema**.
- **Versioning:** Whether warmup/focus/metrics/questions use **immutable versions** (e.g. `warmup_task_v3`) so past reports stay reproducible after admin edits is a **backend + product** decision. The frontend does not send or store version IDs today; it just sends task/question text and IDs. If you want reproducibility:
  - Backend should store **which version** of each task/metric/question was used for each session (e.g. `warmup_task_snapshot` or `warmup_task_version_id` at session create).
  - If admin “edits” tasks, backend either creates new versions (and new sessions use new version) or overwrites (and old sessions keep whatever was stored at attempt time).

### Question for you

- **Do you need strict reproducibility?** I.e. when viewing an old report, must we know exactly which warmup/focus/metric text was used (via version IDs or snapshots)? If yes, backend must add versioning or snapshotting; frontend can stay as-is until backend returns version IDs for display/audit.

---

## 2) Warmup scoring / metric definition

### Answered from codebase

- **Scale:** Docs say performance scores are **0–1** (e.g. `V2_HOMEWORK_FLOW_SPEC`: “0 to 1 (0% to 100%)”). So **score_1** and **score_2** are 0–1.
- **Metric names (recording_1):** Spec says **3 metrics**: strength, fillers, pacing. For recording_2: **5 metrics**: strength, fillers, pacing, metric_answer_1, metric_answer_2 (the last two are “how well they addressed their own answers” or similar—exact meaning is backend).

### Backend / state to define (must-define #2)

- **Per-metric output shape:** Backend must define what each metric returns (0–1, 0–5, 0–100, or categorical + numeric). Recommendation: **0–1 per metric** so aggregation stays simple.
- **Aggregation:** How to combine metrics into **performance_score_1** and **performance_score_2**: weights, average, minimum rule, etc. **Backend must define.**
- **Normalization:** If any metric uses a different scale, backend must normalize before aggregating.
- **Failure modes:** Backend must define: transcription fails, silent audio, language mismatch, too short/long → block progression vs fallback score (e.g. 0 or null) and whether the user can still proceed.
- **Evidence/explanations:** Whether to store per-metric breakdown (for admin/debug) is **backend schema**.

### Question for you

- **Do you want the UI to show a per-metric breakdown** (e.g. “Strength: 0.8, Fillers: 0.6, Pacing: 0.7”) to the student or only the single **score_1** / **score_2**? If breakdown, backend must return it and frontend will display it.

---

## 3) Focus_task selection (matching policy)

### Answered from codebase

- **Eligibility (spec):** `V2_HOMEWORK_FLOW_SPEC` says: focus_task is **eligible** when **min_task_score ≤ performance_score_1**. So “tasks with score ≤ 0.5” in your wording means: focus_tasks whose **threshold** (min or max, depending on schema) allows score_1. In our **admin UI** we only have **max_performance_score** per focus task (same as warmup). So the intended rule is: **eligible when focus_task.max_performance_score ≥ score_1** (student can “handle” that level) **or** **focus_task.max_performance_score ≤ score_1** (only show tasks at or below their level). Your wording (“can only get focus_tasks that are 0.5 or lower”) suggests: **eligible when focus_task.max_performance_score ≤ score_1**. So “max” on the task = “maximum difficulty we show for this score”; if user got 0.5, show tasks with max 0.5 or lower.
- **Tie-breaking (spec):** Docs say if **more than one** focus_task is eligible, backend uses **random** (e.g. `random.shuffle()`).

### Backend / state to define (must-define #3)

- **No eligible focus_task:** Backend must define: if **no** focus_task has max_performance_score ≤ score_1 (e.g. user scored 0.2 and all tasks are 0.5+), do we (a) pick **easiest available** (smallest max), (b) return “no task” and block, or (c) nearest neighbor. **Recommendation:** same as warmup fallback: pick **easiest** (lowest max_performance_score) so the flow never blocks.
- **Tie-breaking:** Already “random” in docs; backend implements. If you later want LRU / rotation / curriculum order, that’s a **backend policy** change.
- **Meaning of focus_task “score”:** Treat **max_performance_score** as “this task is shown only when the user’s score_1 is at least this high” vs “at most this high”—you said “0.5 → tasks ≤ 0.5”, so **max_performance_score** = upper bound on score_1 for which this task is offered. Backend should document it in one sentence.

### Question for you

- **Do metric_question answers influence which focus_task is chosen?** Right now the spec does not say so; focus is chosen only by score_1. If you want “e.g. if they said they struggle with pacing, pick a pacing focus_task”, that’s a **product rule** and backend logic to add.

---

## 4) Transcription / context (context_1, context_2)

### Answered from codebase

- **context_1:** In types and docs it’s **context_short** — “extracted by AI from recording_1”. So it’s **post-processed** (summary or extracted content), not necessarily raw transcript. The report is described as using “context_short” (not “raw transcript”).

### Backend / state to define

- **Exact meaning of context_1 / context_2:** Backend must define and document:
  - **context_1 (context_short):** Raw transcript only, or AI summary, or both stored (raw + short)?
  - **context_2:** Same options for recording_2; and whether report uses only context_1, only context_2, or both.
- **Storage:** What is stored (raw transcript, cleaned, timestamps, confidence, language). **Backend schema + retention.**
- **Privacy / retention / consent:** Backend (and legal) to define. Frontend does not handle consent strings; backend should enforce retention and access.

### Question for you

- **For the coach report (context_end), should we reference both recordings?** e.g. “In your first take you said X; in your second take you did Y.” If yes, backend must pass both context_1 and context_2 (or both transcripts) into the report generator.

---

## 5) Metric_questions (timing, purpose, versioning)

### Answered from codebase

- **Timing:** Metric questions are **after** recording_1, **before** recording_2. User sees task block (context_short + focus_task + metric_question texts) and submits **metric_answer_1, metric_answer_2, metric_answer_3**. So they are “mid-session” self-reflection or intent.
- **Static vs per-user:** In the **admin** we have **3 metric question slots** stored **per user** (getUserMetricQuestions / patchUserMetricQuestions). So they can differ per student (admin configures them).

### Backend / state to define

- **How metric answers are used:** Backend must define explicitly:
  - **Task generation:** They are inputs to the AI that generates **final_task** (confirmed in spec).
  - **Scoring:** Spec says recording_2 is scored with **5 metrics** including “metric_answer_1, metric_answer_2” — so answers are used in **score_2** (e.g. “did they address what they said they’d work on?”).
  - **Gating:** No gating in current spec (answers don’t block progression).
- **Question bank versioning:** If admin edits metric questions, do we snapshot “which questions were used in this session”? Backend decision (see §1 versioning).

### Question for you

- **Can metric_questions vary by focus_task or score_1?** Right now the UI is “3 questions per user” regardless of which focus_task was chosen. If you want different questions per focus or per band, that’s a **product + backend** change (e.g. question sets per focus_task_id).

---

## 6) AI task generation framework (final_task)

### Answered from codebase

- **Inputs (spec):** context_short (context_1), chosen focus_task, metric_question_1/2 (and 3 in UI), and **metric answers**.
- **Output:** A single **final_task** text (string) shown to the user before recording_2. Types: `final_task` / `final_task_text`.

### Backend / state to define (must-define in spirit)

- **TaskSpec / prompt template:** Backend must define:
  - **Exact prompt template** (placeholders: context_1, focus_task text, metric question texts, metric answers).
  - **Output format:** e.g. “2–4 sentences, instruction only, no questions.”
  - **Hard constraints:** max length, forbidden content, language.
  - **Validation:** Non-empty, length within range, maybe “contains focus_task keyword” or similar.
- **Reproducibility:** Store prompt + model + params (or at least model + version) per session for audit. **Backend.**

### Question for you

- **Do you have a preferred structure for the final_task?** e.g. “1) Summary of what we heard. 2) Your focus: [focus_task]. 3) Pay special attention to [answer_1] and [answer_2].” If you give one example, backend can implement to that pattern.

---

## 7) score_2 vs score_transcription (second recording)

### Answered from codebase

- **score_2:** Exists in types; “5 metrics → performance_score_2” (strength, fillers, pacing, metric_answer_1, metric_answer_2). So **score_2** = delivery/performance rubric on recording_2.

### Backend / state to define (must-define #4)

- **What score_transcription is:** You need to pick one meaning and document it so it doesn’t overlap with score_2. Options:
  1. **Task adherence / instruction following:** “Did the transcript match the assigned task?” (semantic match to final_task / focus).
  2. **Textual quality:** Grammar, coherence, structure (separate from delivery).
  3. **Self-report consistency:** Alignment between metric answers (“I’ll work on X”) and what they actually said in the transcript.

- **Recommendation:** Treat **score_2** = **performance/delivery** (from n_metrics on recording_2, possibly using transcript + audio). Treat **score_transcription** = **task adherence / content** (e.g. LLM or rule-based: “did they address the focus and their stated priorities?”). Then no double-counting: one is “how they delivered”, the other “what they said vs what was asked”.

- **If you merge:** If you decide **not** to have a separate score_transcription and instead fold “task adherence” into the 5 metrics (e.g. one of the 5 is “instruction_following”), then **score_transcription** can be dropped and **score_end** can use only score_1 and score_2. **Backend + product** to decide.

### Question for you

- **Do you want a separate score_transcription (0–1) that measures “did they do the task / follow instructions”?** If yes, backend defines how it’s computed (e.g. LLM rubric, keyword coverage). If no, we can rely only on score_2 and possibly one of the 5 metrics as “adherence”.

---

## 8) After_recording_questions (post-recording questions)

### Answered from codebase

- **Optional step:** If no questions are configured for the student, the step is **skipped** (frontend already supports empty list).
- **Stored:** Answers are sent as `answers[]` (question_id + answer_text) and “used later in the report” (spec).

### Backend / state to define

- **Mandatory vs optional:** Backend must define: if there are N questions, can the user submit only some? If they skip one, do we store null and still generate report? **Recommendation:** allow partial answers; report uses “answered” only; no blocking.
- **Role:** Backend must define: reflective (self-assessment) vs factual (difficulty, confidence). That drives report prompt and analytics. No frontend change needed beyond current submit.

### Question for you

- **Should skipping post-recording questions block the report?** (e.g. “You must answer at least one.”) Or is it always optional and report is generated with whatever answers exist?

---

## 9) report_history (score_end, context_end)

### Answered from codebase

- **score_end (spec):** Currently **performance_score_end = (performance_score_1 + performance_score_2) / 2**. So “average of the two performance scores.”
- **context_end:** The **report** is “AI-generated from context_short, performance_score_end, question answers” and appended to **context_long** with timestamp. So **context_end** = that report text (coach-like).

### Backend / state to define (must-define #5)

- **score_end formula:** Backend must fix one formula and document it. Options:
  - Keep **(score_1 + score_2) / 2**.
  - Or **weighted:** e.g. 0.4*score_1 + 0.6*score_2 (emphasize second recording).
  - Or include **score_transcription:** e.g. (score_1 + score_2 + score_transcription) / 3, or a custom mix.
- **Uncertainty/confidence:** If transcription or metrics are low-confidence, should score_end be flagged or adjusted? **Backend** (and optionally surface in UI).
- **Report schema / structure:** Backend must define: fixed sections (e.g. “Summary”, “Scores”, “Next steps”) or free-form; whether to cite evidence (quotes from transcript); tone (coach-like, neutral). **Backend prompt + validation.**

### Question for you

- **Should score_end represent “improvement” (e.g. score_2 − score_1) anywhere in the report?** e.g. “You improved from 0.5 to 0.7.” If yes, backend includes that in the report prompt and possibly stores improvement_delta.

---

## 10) Admin feedback loop (who changes what, impact)

### Answered from codebase

- **student_context:** Admin-only. Stored in **speaker_profile** (e.g. coach_notes, main_goal, motivation). The “Context” textarea is the main coach bio. **User does not see it** in the current UI (it’s under Speaker Profile for admin).
- **What admin can change:** Warmup list, focus list, post-recording questions list, metric questions (3 slots), student context. “Send Homework” re-sends; next session start will use **current** lists and **last performance_score_end** for warmup selection.

### Backend / state to define (must-define #6)

- **When changes take effect:** Backend must define: admin edits apply to **next session only** (recommended). No need to touch in-progress sessions.
- **Mid-session:** If user is in the middle of a session and admin edits tasks/questions, **current session** should keep the data already returned (session already has warmup_text, task_block, etc.). So “effective from next session” is the only sane rule unless you version everything.
- **Re-scoring past sessions:** Backend must decide: do admin “scoring adjustments” **retroactively** change old reports? If **yes**, you must store **original** and **revised** (and who/when). If **no**, past reports are frozen; only future sessions use new rubrics. **Recommendation:** no retroactive re-score; keep reports immutable once generated.
- **Audit trail:** Who changed what (admin user, timestamp, before/after) for tasks, questions, student_context — **backend** (audit table or logs). Frontend does not implement this.

### Question for you

- **Should admins be able to edit the text of an already-generated report** (e.g. tweak wording before the student sees it)? If yes, backend needs “update report” and UI needs “Edit report” on that session; and you must decide if the edited report overwrites the one in context_long or is stored as “admin_override”.

---

## 11) State machine / lifecycle

### Answered from codebase

- Frontend drives flow by **step** (0=loading, 1=warmup+recording_1, 2=task block+metric answers, 3=final task+recording_2, 4=post-questions, 5=report). It does not send “status” to backend except implicitly (e.g. POST recording-1 moves backend to “after recording_1”). So **session status** is effectively **backend state**.

### Backend / state to define

- **Explicit session status enum** and transitions, e.g.:  
  `created → warmup_recorded → warmup_scored → focus_selected → task_generated → task_shown → recording2_uploaded → recording2_scored → post_questions_done → report_generated`  
  Backend should enforce: e.g. don’t accept recording_2 before metric_answers; don’t generate report before post_answers (or allow empty answers). **Backend** implements; frontend already follows the intended order.
- **Retries / idempotency:** If the same recording or same metric-answers is POSTed twice, backend should define: idempotent (same result) or error. **Backend.**

### Question for you

- **If the user abandons after recording_1 (never submits metric answers), should we keep the session and allow “resume later”?** If yes, backend must support GET session status and return “task_block” and allow continuing from step 2; frontend already has a “resume” path if backend returns session_id + step.

---

## 12) QA / anti-cheat / quality control

### Backend / state to define

- **Minimum duration, silence detection, language, length:** Backend must define and enforce (e.g. reject or flag recordings &lt; 5 s, or &gt; 10 min). Frontend can add client-side hints but cannot enforce.
- **Plagiarism / reading / off-topic:** Backend if needed (e.g. for score_transcription or flagging).
- **Model safety:** Generated task and coach report — backend prompt design and optional output checks.

### Question for you

- **Do you need explicit “quality gates” in the UI?** e.g. “Recording too short — try again.” If yes, backend must return a clear error code/reason and frontend will show it.

---

## The 6 “must-define” items — who defines

| # | Item | Who defines | Status |
|---|------|-------------|--------|
| 1 | **Session/Attempt entity + versioning** for tasks/questions/metrics/prompts | **Backend** schema; **you** decide if versions/snapshots for reproducibility | §1 above |
| 2 | **Scoring spec:** per-metric scale, weights, aggregation, fallbacks | **Backend** | §2 |
| 3 | **Focus_task selection:** no-eligible case + tie-breaking | **Backend** (we gave recommendation: pick easiest if none eligible) | §3 |
| 4 | **score_transcription** meaning (avoid overlap with score_2) | **You** choose meaning; **backend** implements | §7 |
| 5 | **score_end** formula + report schema | **Backend** (with your preference on weighting / improvement) | §9 |
| 6 | **Admin edits policy:** versioning, audit, retroactive vs forward-only | **Backend** + **you** (we recommended: no retro re-score; edits apply next session) | §10 |

---

## Summary: what you need to answer

1. **Reproducibility:** Do you need version IDs or snapshots so old reports always show “which warmup/focus/metric text was used”? (Yes/No)
2. **Per-metric breakdown in UI:** Show strength/fillers/pacing (and others) separately to the student, or only score_1/score_2? (Yes/No)
3. **Metric answers influence focus_task choice?** (Yes/No; if yes, how?)
4. **Report uses both recordings?** Reference both context_1 and context_2 in context_end? (Yes/No)
5. **Metric_questions vary by focus_task or score_1?** (Yes/No)
6. **Preferred final_task structure?** (e.g. 1–2–3 pattern; or “no preference, backend decides”)
7. **Separate score_transcription (task adherence)?** (Yes/No; if no, fold into score_2)
8. **Skip post-recording questions:** Block report or allow and report with partial answers? (Block / Allow)
9. **Score_end:** Include “improvement” (score_2 − score_1) in report? (Yes/No)
10. **Admin edit report text** after generation? (Yes/No)
11. **Resume session** after abandoning post recording_1? (Yes/No)
12. **Quality gates in UI** (e.g. “Recording too short”)? (Yes/No)

Once you answer these, the backend can lock the data contract and scoring/selection logic, and the frontend can add any missing UI (breakdown, resume, errors, report edit) accordingly.
