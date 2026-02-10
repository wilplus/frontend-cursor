# Example GET session/status responses and contract

This doc describes example response shapes for **GET /v2/homework/session/status** (or BFF equivalent) and how the frontend should map them.

---

## §1. Example response (task_block)

*(Placeholder: paste a real task_block response here if available.)*

---

## §2. Example response (final_task_ready)

*(Placeholder: paste a real final_task_ready response here if available.)*

---

## §3. Example response (completed)

*(Placeholder: paste a real completed response here if available.)*

---

## §4. Contract realities: compatible vs incompatible

### Compatible (what lines up)

1. **Session id from both sources**  
   Backend may send top-level `session_id` or nested `session.id`. Frontend should use:  
   `sessionId = response.session_id ?? response.session?.id`.

2. **Step from session.status**  
   Backend sends `status` (or `session.status` / `session.state` / `session_state`) with values: `warm_up` | `task_block` | `final_task_ready` | `post_questions` | `completed`. Frontend derives step 1–5 from this only when present; do not override with URL, local state, or recording IDs.

3. **Warm-up in two places**  
   Backend may send `warm_up_task` (e.g. `{ id, text }`) or `warm_up_task_text`, or under `session` (e.g. `session.warm_up_task_text`). Frontend should read:  
   `warmUpText = warm_up_task?.text ?? warm_up_task_text ?? session?.warm_up_task_text ?? ""`.

4. **Final task from session.final_task_text**  
   Backend may send `final_task_text` at top level or as `session.final_task_text`. Frontend should use:  
   `finalTaskText = session?.final_task_text ?? final_task_text ?? toText(final_task) ?? ""`.

---

### Incompatibilities and fixes

**A. No `task_block` in status**  
- **Backend:** Sends `session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3` (or similar) instead of a single `task_block` object.  
- **Impact:** Step 2 has no metric questions to show.  
- **Fix:** Prefer building **taskBlock** from the three strings (e.g. `session_metric_question_1/2/3` → synthetic `{ metric_question_1, metric_question_2, metric_question_3 }`). Only call **GET task-block** when those fields are missing **and** the backend/BFF exposes that route; otherwise you get 404s.

**B. No `final_task` in status**  
- **Backend:** Only sends `final_task_text` (or `session.final_task_text`), not `final_task`.  
- **Impact:** Step 3 prompt is empty if frontend only reads `final_task`.  
- **Fix:** Read `final_task_text` (and `session.final_task_text`) as above; do **not** rely on `final_task` only.

**C. No `questions` in status**  
- **Backend:** Status response does not include a `questions` array for step 4.  
- **Impact:** Step 4 shows no reflective questions.  
- **Fix:** When step is 4 and `questions.length === 0`, call **GET questions** and set questions from that response (existing frontend effect). Do not expect questions inside GET session/status.

**D. Report is `session.context_long`, not `report_text`**  
- **Backend:** Report content is in `session.context_long` (or similar), not `report_text`.  
- **Impact:** Step 5 report area is empty.  
- **Fix:** In `deriveStepFromStatus` / apply logic, set report text from:  
  `reportText = response.report_text ?? response.session?.context_long ?? ""`.  
  Do **not** read only `report_text`.

**E. Everything snake_case**  
- **Backend:** All keys are snake_case (`session_id`, `final_task_text`, `performance_score_end`, etc.).  
- **Impact:** None if frontend already uses snake_case when reading the response. If the frontend expected camelCase, it would miss fields.  
- **Fix:** Ensure all mapping uses snake_case keys from the API; optionally normalize once in the BFF or client.

---

### Watch-outs

- **`has_active_session: false`**  
  If the backend returns `has_active_session: false` (and no session payload), the frontend should clear current session state and require **POST session/start** before showing step 1. Do not keep an old `sessionId` or step.

- **Metric answers shape: `answer_1` / `answer_2` / `answer_3`**  
  Backend may expect or return metric answers as `answer_1`, `answer_2`, `answer_3` instead of `metric_answer_1`, `metric_answer_2`, `metric_answer_3`. Ensure the frontend sends the shape the backend expects (and maps any response shape to local state if needed).

---

### Minimal mapping (code-style snippet for applyStatusToState)

Use this as the exact field mapping when applying GET session/status to frontend state. Backend is assumed to use **snake_case** and may nest under `session`.

```ts
// Session id
const sessionId = response.session_id ?? response.session?.id;

// Step: only from status (do not override when present)
const statusRaw = response.status ?? response.session?.status ?? response.session?.state ?? response.session_state ?? "";
const status = statusRaw.toLowerCase().trim();
// Map status → step 1–5 (warm_up→1, task_block→2, final_task_ready→3, post_questions→4, completed→5)

// Warm-up text
const warmUpText = response.warm_up_task?.text ?? response.warm_up_task_text ?? response.session?.warm_up_task_text ?? "";

// Step 2: task block — build from session_metric_question_1/2/3 if no task_block
const taskBlock = response.task_block ?? (response.session_metric_question_1 != null
  ? {
      metric_question_1: response.session_metric_question_1,
      metric_question_2: response.session_metric_question_2,
      metric_question_3: response.session_metric_question_3,
    }
  : null);
// If taskBlock still null, existing effect can call GET task-block when step === 2

// Final task text (do not read final_task only)
const finalTaskText = response.session?.final_task_text ?? response.final_task_text ?? toText(response.final_task) ?? "";

// Report text (backend may use context_long)
const reportText = response.report_text ?? response.session?.context_long ?? "";

// Score and questions
const performanceScoreEnd = response.performance_score_end ?? response.session?.performance_score_end ?? null;
const questions = Array.isArray(response.questions) ? response.questions : [];
// If step === 4 and questions.length === 0, call GET questions (existing effect)
```

---

### Bottom line

The contract is **compatible** with the frontend’s step-from-status and apply flow, but it is **not plug-and-play** unless the frontend:

- **Drops** the expectation that `task_block` is always present (use `session_metric_question_1/2/3` or GET task-block).
- **Drops** the expectation that `final_task` is present (use `final_task_text` / `session.final_task_text`).
- **Drops** the expectation that `questions` are inside status (use GET questions for step 4 when empty).
- **Drops** the expectation that report is only in `report_text` (use `session.context_long` as fallback).

Once these mappings are in place (as in the minimal mapping above), the flow can work against the current backend contract.
