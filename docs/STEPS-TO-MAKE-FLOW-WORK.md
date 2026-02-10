# Clear steps to make the homework flow work

Follow these in order. References: **`docs/EXAMPLE-GET-SESSION-STATUS-RESPONSES.md` §4** and **`docs/IMPLEMENT-THIS-TO-MAKE-FLOW-WORK.md`**.

The sections below follow the **implementation order** (test after each step). If you paste your current **`applyStatusToState()`** and **`deriveStepFromStatus()`**, the exact lines to change for the backend contract can be pointed out using §4 of the example doc and the minimal mapping.

---

## Before you start — two pre-checks

1. **Confirm the frontend talks to the right backend**  
   Same domain/env as the example GET session/status JSON you’re implementing against. Avoid implementing against a different or mock API.

2. **Choose a single mapping strategy**  
   Either keep **snake_case** everywhere in UI state, or **normalize once** in `applyStatusToState()` (and in step derivation) and use **camelCase** everywhere else. The latter is recommended. Don’t mix both.

---

## Implementation order (test after each step)

1. **Status-first step derivation** — Step from `session.status` (or equivalent); if `has_active_session: false`, clear session and show “Start”.
2. **Session id normalization** — `sessionId = res.session_id ?? res.session?.id ?? null`; no session-scoped calls when there’s no sessionId.
3. **Use the correct fields** — Warm-up from `warm_up_task.text` / `session.warm_up_task_text`; step 2 from `session_metric_question_1/2/3`; final task from `session.final_task_text`; report from `session.context_long`; score from `session.performance_score_end`.
4. **Fetch-on-demand** — Step 4: fetch questions (e.g. using `post_question_ids` or GET questions); questions are not in status.

The numbered sections below match this order.

---

## 1. Handle `has_active_session: false`

**Where:** The place that calls **GET session/status** on load (e.g. the auth-ready effect in `HomeworkFlowCard`).

**Do:**
- After receiving the response, if **`response.has_active_session === false`** (and there is no session payload):
  - **Clear** `sessionId` and all session-derived state (step, warmUpText, taskBlock, etc.).
  - Do **not** call any session-scoped API (recording-upload-url, recording-1, task-block, etc.) until **POST session/start** has been called and returned a new session id.
- Then call **POST session/start** (or your start handler) and apply the start response; show step 1.

**Why:** Avoids using a stale or invalid session and prevents 409s from wrong session/step.

---

## 2. Status-first and overwrite every time

**Where:** Every code path that receives a successful **GET session/status** response.

**Do:**
- Always run your **applyStatusToState(response)** (or equivalent) and **overwrite** the current UI step and all step-dependent state from the response. Do **not** preserve the previous step “just in case”; the response is the source of truth for that request.

**Why:** Prevents the “stale step” bug (UI on step 1 while backend is already task_block or later).

---

## 3. Map session id from both sources

**Where:** Inside your “apply status to state” logic (e.g. `applyStatusToState` or the first lines of `deriveStepFromStatus` / response handling).

**Do:**
- Set **sessionId** from:  
  `response.session_id ?? response.session?.id`  
  (and clear it if there is no session, e.g. when `has_active_session: false`).

**Why:** Backend may send id at top level or under `session`.

---

## 4. Derive step only from status

**Where:** Step derivation (e.g. `deriveStepFromStatus`).

**Do:**
- Read **status** from:  
  `response.status ?? response.session?.status ?? response.session?.state ?? response.session_state ?? ""`  
  then normalize (e.g. `.toLowerCase().trim()`).
- Map to step 1–5:  
  `warm_up`→1, `task_block`→2, `final_task_ready`→3, `post_questions`→4, `completed`→5.
- When this normalized **status** is one of these five, **use only it** to set the step; do not override with URL, local state, or `recording_1_id` / `recording_2_id`. Use fallbacks (e.g. IDs, legacy status strings) only when status is missing or unknown.

**Why:** Matches backend state machine and avoids 409s.

---

## 5. Warm-up text from three places

**Where:** Same place you derive `warmUpText` from the status response (e.g. inside `deriveStepFromStatus` or before calling it).

**Do:**
- Set **warmUpText** from:  
  `response.warm_up_task?.text ?? response.warm_up_task_text ?? response.session?.warm_up_task_text ?? ""`.

**Why:** Backend may send warm-up at top level or under `session`.

---

## 6. Task block: prefer three strings, then GET task-block only if needed

**Where:** Derivation of **taskBlock** for step 2 (e.g. inside `deriveStepFromStatus` or your apply logic).

**Do:**
- Prefer building **taskBlock** from the three metric question fields:  
  - If **`response.task_block`** exists, use it.
  - Else if **`response.session_metric_question_1`** (or `session.session_metric_question_1`) and the other two exist (or backend sends equivalent keys), build a synthetic task block, e.g.:  
    `{ metric_question_1: {...}, metric_question_2: {...}, metric_question_3: {...} }`  
    (adapt to the exact shape your UI expects).
- Only call **GET task-block** when those three strings/objects are **missing** **and** your backend/BFF actually exposes **GET task-block**. If the route does not exist, do not call it (you’ll get 404s).

**Why:** Backend often sends the three questions in status; GET task-block is optional fallback and must exist.

---

## 7. Final task text: use `final_task_text` and `session.final_task_text`

**Where:** Where you set **finalTaskText** from the status response.

**Do:**
- Set **finalTaskText** from:  
  `response.session?.final_task_text ?? response.final_task_text ?? toText(response.final_task) ?? ""`.  
  Do **not** rely only on **`final_task`**; backend may send only **`final_task_text`** or **`session.final_task_text`**.

**Why:** Aligns with backend contract (see EXAMPLE-GET-SESSION-STATUS-RESPONSES.md §4).

---

## 8. Report text: use `report_text` or `session.context_long`

**Where:** Where you set **reportText** from the status response (e.g. for step 5).

**Do:**
- Set **reportText** from:  
  `response.report_text ?? response.session?.context_long ?? ""`.  
  Do **not** read only **`report_text`**; backend may put the report in **`session.context_long`**.

**Why:** Avoids empty report on step 5 when backend uses `context_long`.

---

## 9. Performance score from two places

**Where:** Where you set **performanceScoreEnd** from the status response.

**Do:**
- Set **performanceScoreEnd** from:  
  `response.performance_score_end ?? response.session?.performance_score_end ?? null`.

**Why:** Backend may send at top level or under `session` (snake_case).

---

## 10. Questions for step 4: status or GET questions

**Where:** Where you set **questions** for step 4, and any effect that runs when step is 4.

**Do:**
- If the status response includes a **`questions`** array (with id + text), use it and do not call GET questions.
- If for step 4 you only have **`post_question_ids`** or **questions** is empty, call **GET questions** and set **questions** from that response (your existing “thin status” effect for step 4 is correct).

**Why:** Matches thin vs full status (IMPLEMENT-THIS-TO-MAKE-FLOW-WORK.md §1.3).

---

## 11. Types / response shape

**Where:** Your TypeScript type for the GET session/status response (e.g. `HomeworkSessionStatus` or the type passed to `applyStatusToState`).

**Do:**
- Allow at least:  
  `session_id`, `session.id`, `status`, `session.status`, `session.state`, `session_state`,  
  `warm_up_task`, `warm_up_task_text`, `session.warm_up_task_text`,  
  `task_block`, `session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3`,  
  `final_task`, `final_task_text`, `session.final_task_text`,  
  `report_text`, `session.context_long`,  
  `performance_score_end`, `session.performance_score_end`,  
  `questions`, `has_active_session`.  
  Use a type that permits both top-level and `session`-nested fields (and snake_case).

**Why:** So the mapping code compiles and matches the real backend payload.

---

## 12. Optional: Step 5 when report is missing

**Where:** Step 5 (report) UI or the logic that sets report content.

**Do:**
- If after applying status for step 5 you have no report text (e.g. `context_long` and `report_text` both absent):
  - If your backend has a **GET report** (or similar) endpoint, call it and set report from the response.
  - If not, show a fallback like “Report pending” or “Report not available yet.”

**Why:** Thin status for step 5; see IMPLEMENT-THIS-TO-MAKE-FLOW-WORK.md §1.3.

---

## Checklist (quick reference)

- [ ] **1** Handle `has_active_session: false` → clear session, require POST start.
- [ ] **2** On every successful GET status, overwrite step and state (no preserving previous step).
- [ ] **3** sessionId from `session_id ?? session.id`.
- [ ] **4** Step only from `status` / `session.status` / `session.state` / `session_state`; map to 1–5.
- [ ] **5** warmUpText from `warm_up_task.text ?? warm_up_task_text ?? session.warm_up_task_text`.
- [ ] **6** taskBlock from `task_block` or build from `session_metric_question_1/2/3`; GET task-block only if missing and route exists.
- [ ] **7** finalTaskText from `session.final_task_text ?? final_task_text ?? toText(final_task)`.
- [ ] **8** reportText from `report_text ?? session.context_long`.
- [ ] **9** performanceScoreEnd from `performance_score_end ?? session.performance_score_end`.
- [ ] **10** questions from status or GET questions when step 4 and empty.
- [ ] **11** Types allow all above keys (top-level and under `session`, snake_case).
- [ ] **12** (Optional) Step 5 fallback when report absent: GET report or “Report pending”.

---

## How to finish — Definition of Done (network progression)

Run the full flow and watch the **network** for each step. If anything breaks, capture the failing request so the last 1–2 integration issues can be fixed quickly.

**What to do**

1. **Run the Definition of Done network progression**  
   Go through the student flow end-to-end (load → GET status or POST start → step 1 → recording-upload-url → upload → recording-1 → step 2 → metric-answers → step 3 → recording-2 → questions → post-answers → report). Watch the Network tab (or equivalent) for each request.

2. **If something breaks, paste one failing request** with:
   - **Request URL**
   - **Status code**
   - **Response body** (JSON)
   - **For Storage failures:** bucket + object path, and whether the request had **Authorization** (header or cookie)

That will allow closing the last 1–2 integration issues quickly (e.g. wrong URL, missing auth, wrong field name, or Storage CORS/RLS).
