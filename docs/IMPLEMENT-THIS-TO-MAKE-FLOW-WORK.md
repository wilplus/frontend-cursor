# Implement this to make the flow work

This doc tells implementers exactly what to change so the student homework flow works with the real backend contract.

---

## §1. Align GET session/status with backend response

### §1.1 Contract and minimal mapping

**Full contract (compatible vs incompatible, watch-outs, minimal mapping):**  
See **`docs/EXAMPLE-GET-SESSION-STATUS-RESPONSES.md` §4**.

**Do not read:**

- **task_block** — Backend may not send it. Use **session_metric_question_1**, **session_metric_question_2**, **session_metric_question_3** to build a synthetic task block, or rely on **GET task-block** when step is 2 and task block is missing.
- **final_task** — Backend may only send **final_task_text** (or **session.final_task_text**). Use those.
- **report_text** only — Backend may put the report in **session.context_long**. Use **report_text ?? session.context_long**.

**Minimal mapping keys (backend uses snake_case):**

| Frontend state   | Source (in order of preference) |
|------------------|----------------------------------|
| sessionId        | `session_id`, `session.id` |
| step             | Derived from `session.status` (or `status`, `session.state`, `session_state`) only |
| warmUpText       | `warm_up_task.text`, `warm_up_task_text`, `session.warm_up_task_text` |
| taskBlock (step 2) | `task_block`, or build from `session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3`; else GET task-block when step 2 |
| finalTaskText    | `session.final_task_text`, `final_task_text` (do not rely on `final_task` only) |
| reportText       | `report_text`, `session.context_long` |
| performanceScoreEnd | `performance_score_end`, `session.performance_score_end` |
| questions (step 4) | `questions` if present; else GET questions when step 4 and empty |

If the frontend/BFF assistant pastes their current **applyStatusToState()** (or equivalent) and the raw backend GET session/status response shape, the exact lines to change can be pointed out using **§4** of `EXAMPLE-GET-SESSION-STATUS-RESPONSES.md` and this minimal mapping.

---

### §1.2 Status-first and overwrite (prevent stale step)

- On every successful **GET session/status**, **overwrite** the UI step from `session.status` (or equivalent). Do **not** preserve a previous step; the response is the source of truth for this request.
- If the backend returns **`has_active_session: false`** (and no session payload), **clear** `sessionId` and any in-memory session, and do **not** call any session-scoped endpoints until **POST session/start** returns a new session id. Then apply the start response and show step 1.

This prevents the common “stale step” bug where the UI shows step 1 but the backend is already in task_block or later.

---

### §1.3 Thin vs full status: when to do follow-up GETs

Use this to decide when an extra request is needed. Do **not** assume status always contains full payloads; do **not** add calls to endpoints that don’t exist in your backend/BFF.

| Step | Status value | If status contains … | Action |
|------|--------------|----------------------|--------|
| **2** | `task_block` | `session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3` (or `task_block`) | **No** follow-up GET. Build task block from these and render. |
| **2** | `task_block` | Only IDs or nothing for metric questions | **GET task-block** only if that route exists in your backend/BFF (see warning below). Otherwise build from whatever status sends or show a fallback. |
| **4** | `post_questions` | Full `questions` array (id + text) | **No** follow-up GET. |
| **4** | `post_questions` | Only `post_question_ids` (or empty) | **GET questions** required to load question text. |
| **5** | `completed` | `context_long` (or `report_text`) | **No** follow-up GET. Render report. |
| **5** | `completed` | Report field absent | If your backend has a **GET report** (or similar) endpoint, call it. Otherwise render “Report pending” or equivalent. |

**Warning: GET task-block**  
The examples show status containing the three metric question strings, so the frontend can build the task block from status and **no extra endpoint is required**. If you keep “GET task-block” as a fallback, ensure that route **actually exists** in your backend/BFF. Implementing a call to a non-existent GET task-block will cause 404s. If the backend does not expose GET task-block, use only the fields present in GET session/status (e.g. `session_metric_question_1/2/3`) to build the step 2 UI.
