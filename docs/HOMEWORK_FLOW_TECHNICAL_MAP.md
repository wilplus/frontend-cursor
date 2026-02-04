# Homework flow: your technical spec vs what’s in place

This maps your intended technical flow to the current frontend and docs, and calls out what’s missing or needs your input.

---

## Your flow (summary)

1. **Warm-up selection:** From **last homework report** take `performance_score` → choose **warm_up_task** from available ones where **task score ≤** that last performance_score.
2. **After warm-up (recording 1):** Transcribe → extract **context** (temporarily stored) → compute **performance_score_1** → choose **focus_task** from available where **task score ≤ performance_score_1** (e.g. 0.6 → tasks with score 0.6 or lower).
3. **Metric questions:** User answers 2 metric questions.
4. **Final task:** AI-built from **context** (recording_1) + **focus_task** (chosen by performance_score_1); exact code/LLM constraints **to be defined** (you said: ask additionally).
5. **Reflective questions:** If enabled for this student by admin → ask; then report.
6. **Report:** **performance_score_final** + coaching text based on context, reflective answers, commentary on performance and how the student stuck to the metrics.

---

## What’s already in place

### Frontend (done)

| Your step | Frontend |
|-----------|----------|
| Start session, get warm_up_task | Calls `POST /api/homework/session/start`; displays `warm_up_task_text`. |
| Recording 1 | Uploads to `POST .../session/:id/recording-1`; shows “Sending first recording”. |
| Task text + metric questions | Displays `task_text`; shows **metric labels** from API (`metric_question_1_text` / `metric_question_2_text` if present); two text inputs; submits `metric_answer_1`, `metric_answer_2`. |
| Final task + recording 2 | Displays `final_task_text`; uploads to `POST .../recording-2`. |
| Reflective questions | `GET .../questions`; if list non-empty, shows form; submits `POST .../post-answers` with `answers[]`. |
| Report | Displays `report_text` and `performance_score_end`. |

So: **UI flow, API calls, and displayed fields match your steps.** No frontend change needed for the flow itself.

### Backend / API (partially specified in docs)

| Your step | In docs |
|-----------|---------|
| Context from recording 1 | Yes: “context_short” from recording_1 (e.g. in `V2_HOMEWORK_FLOW_SPEC`). |
| performance_score_1 | Yes: computed after recording_1; formula TBD. |
| Focus task by score | Yes: focus tasks have `min_task_score` / `max_task_score`; eligibility by `performance_score_1` (e.g. min_task_score ≤ performance_score_1); random if several. |
| Final task = context + focus_task + … | Yes: “AI-generated” from context, focus_task, metric answers; **exact LLM rules not defined**. |
| Questions “if enabled for student” | Yes: backend can return 0 or N questions (e.g. from `assigned_post_question_ids`); frontend already skips step if empty. |
| Report content | Partially: report from context, performance_score_end, question answers; **not** explicitly “commentary on how student stuck to metrics” or “both recordings”. |

---

## Where things are missing or need decisions

### 1. Warm-up task selection from **previous report** — SPEC DONE

- **Rule:** See **WARM_UP_SELECTION_SPEC.md**. Each warm-up has **max_performance_score** (0–1). Selection: eligible where max_performance_score ≥ student’s last performance_score_end; among eligible, pick closest (within ±3%); randomize if multiple; first-time student gets easiest (highest max); fallback if too high = hardest (lowest max).
- **Backend:** Implements selection on `POST /v2/homework/session/start`; warm-up GET/POST/PUT include `max_performance_score`.
- **Frontend (admin):** UI to view/edit `max_performance_score` per warm-up; create sends default 1.0 if omitted.

---

### 2. Focus task selection (already aligned, small clarification)

- **Your rule:** If performance_score_1 = 0.6, choose focus_task from tasks with **score ≤ 0.6**.
- **Current spec:** Focus tasks have `min_task_score` and `max_task_score`; eligible when `min_task_score ≤ performance_score_1` (and typically `performance_score_1 ≤ max_task_score`).
- **Clarification:** Is “task score” here:
  - (A) a **single** field per task (e.g. “difficulty” or “target score”), and eligible when **that value ≤ performance_score_1**, or  
  - (B) exactly the existing **min_task_score / max_task_score** range (eligible when performance_score_1 is inside that range)?

If (B), the current docs already match. If (A), we need to add or rename a field and the rule in the backend spec.

---

### 3. Final task: **exact LLM / code constraints** (you said: ask you additionally)

- **Your rule:** Final_task = context (recording_1) + focus_task (chosen by performance_score_1), “put together by the AI”; “exact code it should follow is very important and is yet to be defined, so that LLM is constrained”.
- **In place:** Only the high-level idea (context + focus_task + metric answers); no prompt, structure, or constraints doc.
- **Open:** I’ll need your input on:
  - Exact **prompt** (or prompt structure) for the LLM that builds `final_task_text`.
  - **Constraints:** length, format, what must be included (context snippet, focus_task text, metric answers), what the model must not do.
  - Any **non-LLM** rules (e.g. “always prepend context in one sentence, then focus_task, then metric answers”).

Once you define this, it can be written into a backend/LLM spec (and implemented on the backend; frontend already just shows `final_task_text`).

---

### 4. Report content (small spec gap)

- **Your rule:** Report includes **performance_score_final** and coaching text based on **context**, **reflective questions**, **commentary on performance** and **how student stuck to the metrics**.
- **Current:** Report is “from context_short, performance_score_end, question answers”; not explicitly “both recordings” or “how student stuck to metrics”.
- **Suggested:** In the backend/LLM spec, state explicitly that:
  - The report should cover **both** recording_1 and recording_2 (and optionally metric adherence).
  - `performance_score_end` is the “performance_score_final” you refer to.

No frontend change needed; this is backend/LLM content.

---

### 5. Reflective questions “enabled for this student”

- **Your rule:** Reflective questions only if “enabled for this student by the admin”.
- **In place:** Frontend calls `GET .../questions`; if the list is empty, it skips to report. So “enabled” = backend returns non-empty list (e.g. from student overrides like `assigned_post_question_ids` or a dedicated “questions enabled” flag).
- **Conclusion:** No frontend gap; backend only needs to return 0 vs N questions according to admin config.

---

## Summary table

| Item | In place? | Where | Open / action |
|------|-----------|--------|----------------|
| Flow order (warm-up → rec1 → task + metrics → final → rec2 → questions → report) | Yes | Frontend + docs | — |
| Context from recording_1, stored temporarily | Yes | Docs (context_short) | — |
| performance_score_1 after recording_1 | Yes | Docs | Formula TBD |
| Focus task chosen by performance_score_1 (score ≤ perf_1) | Yes | V2_HOMEWORK_FLOW_SPEC (min/max) | Confirm (A) single score vs (B) min/max |
| Metric questions (2) displayed and submitted | Yes | Frontend + API | — |
| Final task = context + focus_task (+ metric answers) by AI | Partially | Docs (high-level only) | **You:** exact LLM/code constraints and prompt |
| Reflective questions if enabled for student | Yes | Frontend (0 vs N from API) | Backend returns list by admin config |
| Report = performance_score_final + coaching (context, reflective, metrics adherence) | Partially | Docs | Make explicit in backend spec; backend implements |
| **Warm-up chosen by last report performance_score** | **No** | — | **You:** warm-up task score field + backend rule |
| Warm-up tasks have a “score” in admin | No | Admin API has no score for warm-up | Add if you want “task score ≤ last performance_score” |

---

## What I need from you

1. **Warm-up selection:** Confirm how “score” works for warm-up tasks (one number per task? field name?) and that the rule is “choose warm_up_task where task score ≤ last homework performance_score”. Then we can add it to the admin API contract and backend spec.
2. **Focus task:** Confirm whether selection is (A) single score per task, or (B) current min/max range.
3. **Final task LLM:** Provide (or co-write) the exact prompt and constraints for the model that builds `final_task_text` so it can be documented and implemented in a constrained way.

Everything else in your technical flow either is already in place or is a backend/LLM content change with no frontend work.
