# Debug plan: which of the 3 metric-step failure points is failing

Use this plan to see **which one** of the three known failure modes is actually happening in your environment. Run the steps in order and record results.

---

## The 3 failure points

| # | Failure point | Symptom | Backend signal |
|---|----------------|---------|----------------|
| **1** | Validation (wrong/missing answers) | Continue does nothing; user stays on step 2 | **422** + `code: "VALIDATION_ERROR"`, `message: "Please answer all questions..."` |
| **2** | Recording 1 not ready (processing or failed) | Continue does nothing or shows error; user stuck | **409** + `code: "RECORDING_1_PROCESSING"` or `RECORDING_1_FAILED` |
| **3** | Session already at step 2 when asking for upload URL | 409 on `recording-upload-url` or metric questions empty after recovery | **409** on `POST .../recording-upload-url` with `status: "task_block"`, or **200** with `already_past_step` + `task_block` |

---

## Step 1: Confirm which request is failing

**Goal:** See whether the problem is on **metric-answers** or on **recording-upload-url**.

1. Open DevTools → **Network** tab. Filter by **Fetch/XHR**.
2. Start (or continue) a homework session until you reach **step 2** (metric questions).
3. Fill the metric questions and click **Continue**, or (if you never see questions) just wait / refresh and watch the network.

**Record:**

- [ ] **A)** Do you see a **POST** to `.../metric-answers`?
  - If **yes** → note **status** (200 / 409 / 422) and go to **Step 2**.
  - If **no** → you may be stuck before step 2; note any **POST** to `.../recording-upload-url` and its status → go to **Step 3**.
- [ ] **B)** Do you see a **POST** to `.../recording-upload-url` with body `{"recording":"1"}` **after** you’re already on the metric screen (or after refresh on step 2)?
  - If **yes** → note **status** (200 / 409) and response body → go to **Step 3**.

**Interpretation:**

- Only **metric-answers** fails (422 or 409) → failure point **1** or **2**.
- **recording-upload-url** fails (409) or returns 200 with `already_past_step` while metric questions stay empty → failure point **3**.

---

## Step 2: If metric-answers is failing — 422 or 409?

**Goal:** Separate failure point **1** (validation) from **2** (recording not ready).

1. In Network, click the **POST** `.../metric-answers` request.
2. Open **Preview** or **Response**.
3. Note:
   - **HTTP status** (422 vs 409)
   - **Body:** `code`, `message` (and if present `recording_1_fallback`).

**Record:**

- [ ] Status **422** and `code: "VALIDATION_ERROR"` (and message like “Please answer all questions...”)
  - → **Failure point 1:** backend expects different number of answers than the UI is sending, or frontend isn’t showing this error.
- [ ] Status **409** and `code: "RECORDING_1_PROCESSING"` or `"RECORDING_1_FAILED"`
  - → **Failure point 2:** recording-1 not ready or failed; check if the UI shows the backend `message` and if user can retry/abandon.
- [ ] Status **200** with `recording_1_fallback: true` and `message`
  - → Backend fallback is working; check if the UI shows the message and advances to step 3.

**Interpretation:**

- **422** → Fix 1: ensure we only send answers for questions that exist, and always show `message` on 4xx.
- **409** → Fix 2: show backend `message`, disable double-submit, and (for RECORDING_1_FAILED) disable Continue until abandon.
- **200** but no advance → check frontend handling of 200 (final_task, step 3).

---

## Step 3: If recording-upload-url is involved (409 or 200 with already_past_step)

**Goal:** Confirm failure point **3** (session already task_block; step/task_block not applied).

1. In Network, find **POST** `.../recording-upload-url` with body `{"recording":"1"}`.
2. Note:
   - **Status:** 409 vs 200
   - **Response body:**  
     - If **409:** `code`, `status` (e.g. `"task_block"`).  
     - If **200:** `already_past_step`, `task_block` (and optionally `status`).

**Record:**

- [ ] **409** with `status: "task_block"` (or similar)
  - → Backend says “session is already task_block”. Check: after this 409, does the UI show **step 2** and do **metric questions** appear (from GET task-block or status)?
- [ ] **200** with `already_past_step: true` and `task_block: { ... }`
  - → Backend is telling the frontend “you’re already at step 2; here’s task_block”. Check: does the UI go to step 2 and show those questions (no 409, no empty form)?

**Interpretation:**

- **409** and then **empty metric form** or still on step 1 → Failure point 3: reconciliation after 409 not applying status/task_block (or GET task-block not called / not used).
- **200** with `already_past_step` but **empty metric form** → Failure point 3: frontend not applying `task_block` from this 200 (or not advancing to step 2).
- **200** with `already_past_step` and **metric questions visible** → Failure point 3 is fixed for this path.

---

## Step 4: Add minimal logs to pin down the exact path (optional)

If you still can’t tell which of the 3 it is, add one log at a time and reproduce.

**4a) Metric-answers response**

In `HomeworkFlowCard.tsx`, in `handleMetricAnswersSubmit`, right after `const metricResponse = await homeworkApi.submitMetricAnswers(...)`:

- Log: `metric-answers status 200`, or in the catch block log: `metric-answers error`, `errCode`, `errMessage`.

→ Confirms whether the failure is 422/409 and which code.

**4b) Recording-upload-url / recording-1**

In `HomeworkFlowCard.tsx`, in `handleRecording1Complete`:

- In the `try` block, after `uploadRecording1`: log whether you got `alreadyAtStep2` or normal response.
- In the `catch` block for `isInvalidSessionStateError`: log `reconcileSessionState called` and after it: `step`, `taskBlock != null`.

→ Confirms whether failure point 3 is in “already at step 2” handling or in 409 reconciliation.

**4c) Step 2 render**

In the step 2 branch, log once per render: `step`, `taskBlock != null`, `taskBlockFetchSettled`, `showMetricForm`.

→ Confirms whether we show loading forever (task block never set) or form with empty questions.

---

## Summary table: “Which problem is it?”

| Observation | Likely failure point | Next check |
|-------------|----------------------|------------|
| metric-answers returns **422** | **1** – validation | Inspect payload (answer_1/2/3) and backend config (how many questions). Ensure UI shows backend `message`. |
| metric-answers returns **409** RECORDING_1_* | **2** – recording not ready | Ensure UI shows backend `message`, button disabled while submitting and (for FAILED) until abandon. |
| recording-upload-url returns **409** and metric form stays empty or step wrong | **3** – state after 409 | Ensure `reconcileSessionState` runs and GET task-block is used when status is task_block. |
| recording-upload-url returns **200** with `already_past_step` but form empty | **3** – 200 response not applied | Ensure `alreadyAtStep2` branch sets step 2 and `task_block` from response. |
| No metric-answers request; only recording-upload-url **409** | **3** – stuck before step 2 | Same as “recording-upload-url 409” above; reconciliation and task_block for step 2. |

---

## After you know which one

- **1** → Backend: only require answers for configured questions. Frontend: show only questions with text; always display API `message` on 422.
- **2** → Frontend: show backend message on 409; disable submit while in flight; for RECORDING_1_FAILED disable Continue until abandon. Backend: optional 200 fallback with `recording_1_fallback` + message.
- **3** → Frontend: after 409 on recording-upload-url, call `reconcileSessionState(sessionId)` (GET status + apply + GET task-block when step 2). On 200 with `already_past_step` + `task_block`, set step 2 and task_block and do not upload again. Defensive step 2: show “Loading questions…” until task_block is loaded or fetch has settled.

Use this plan once per session; record which step (1–4) and which option (A/B, 422/409/200) you hit so you can say exactly: “The problem is failure point 1/2/3.”
