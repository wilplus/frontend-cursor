# Willab — App description (single source of truth)

**Taskmaster is the only source of truth for this app.** Everything you need to understand the product, flow, contracts, implementation, and gaps is in this folder. Use this file for Cursor, onboarding, and task planning.

---

## 1. What the app is

- **Product:** Willab is a **speech coaching app**. The student homework flow is a fixed sequence: **warm-up recording** → **3 self-rating questions** (pre-questions: keywords, emotion, CTA) → **final task recording** → **reflective questions** (if configured) → **final report with score**.
- **Users:** Students (Supabase Auth). Admin/coach features (students, tasks, warm-ups, questions, reports) live in separate admin flows.
- **This repo:** **Frontend** (Next.js) and **BFF** (Next.js API routes). The **backend** (Flask) and its full spec live in a **separate repo**.
- **Deployment:** Frontend/BFF call the backend via a configurable base URL (`NEXT_PUBLIC_API_URL`). Audio is stored in **Supabase Storage** (bucket `audio_recordings`); other data in **Supabase (PostgreSQL)**.

---

## 2. Homework flow (steps)

One **active** session per student. **GET session/status** is the single source of truth for “which step the user is on.” Frontend derives step 1–5 from **session.status** only; no overriding from URL, local state, or recording IDs.

| Step | Name           | Student action              | Backend status     | Main APIs |
|------|----------------|-----------------------------|--------------------|-----------|
| 0    | No session     | Clicks “Start”              | —                  | GET status, POST start |
| 1    | Warm-up        | Records warm-up; sees wheel (strength/pace) | `warm_up`          | GET status, recording-upload-url (rec "1"), Storage upload, POST recording-1; wheel = client-side strength/pace (useRealtimeStrengthPace) |
| 2    | Metric answers | Answers 3 questions (Q1 keywords, Q2 emotion, Q3 CTA) | `task_block`       | GET status, GET task-block (optional), POST metric-answers |
| 3    | Final task     | Records final task (1–5 min); wheel (strength/pace)  | `final_task_ready` | GET status, recording-upload-url (rec "2"), upload, POST recording-2 |
| 4    | Post-questions | Answers reflective Qs (must answer all if any exist) | `post_questions`   | GET status, GET questions, POST post-answers |
| 5    | Report         | Views report and score      | `completed`        | **Entered only after POST post-answers succeeds.** Use the **post-answers response body** (report_text, performance_score_end) to render step 5. **Do not** call GET status to show the report: GET status does **not** return completed sessions, so the frontend must not block step 5 on it. |

- **After step-advancing actions (recording-1, metric-answers, recording-2):** Frontend calls **GET session/status** and applies the response (applyStatusToState) so the UI stays in sync.
- **After POST post-answers:** Do **not** refetch GET status to show the report. Use the **post-answers response** to set step to 5 and to set report text and score; GET status does not return completed sessions.
- **Active session:** GET status returns only in-progress sessions (warm_up, task_block, final_task_ready, post_questions). **Completed** is not active; after completion the next load gets no active session and the frontend calls POST start for a new one.

---

## 3. API paths (frontend vs backend)

- **Frontend** calls **same-origin** paths only (no `v2` in URL):
  - **Homework:** `/api/homework/session/status`, `/api/homework/session/start`, `/api/homework/session/[sessionId]/recording-upload-url`, `recording-1`, `recording-2`, `metric-answers`, `questions`, `post-answers`, `task-block`. (No `recording-metrics-chunk`; real-time wheel is client-side only.)
  - **Admin:** `/api/admin/*` (students, tasks, warm-up-tasks, post-recording-questions, metrics, etc.)
- **BFF** proxies to backend with **Authorization: Bearer &lt;supabase_access_token&gt;**:
  - Homework → `BASE_URL/v2/homework/session/status`, `.../start`, `.../session/:id/recording-1`, etc.
  - Admin → `BASE_URL/v2/admin/*`
- **Backend** serves `/v2/homework/*`, `/v2/admin/*`. Base URL from `NEXT_PUBLIC_API_URL` (or `NEXT_PUBLIC_BACKEND_URL` / `BACKEND_URL`). **Mock:** If `NEXT_PUBLIC_API_URL` is unset or `MOCK_HOMEWORK_BACKEND=1`, the BFF can return stub JSON so the flow runs without a backend.

---

## 4. GET session/status — response shape and mapping

- **Response:** Either `{ has_active_session: false, session: null }` or `{ has_active_session: true, session_id: "<uuid>", session: <object> }`. The `session` object is often the raw **v2_sessions** row (snake_case). Backend may send top-level fields or nest under `session`.
- **Session id:** `sessionId = response.session_id ?? response.session?.id ?? null`. No session-scoped calls without a valid sessionId.
- **Status → step:** Read status from `response.status ?? response.session?.status ?? response.session?.state ?? response.session_state ?? ""`, then map the **five canonical** values: `warm_up`→1, `task_block`→2, `final_task_ready`→3, `post_questions`→4, `completed`→5. The frontend also maps **aliases** (e.g. after recording 1 the backend may return `warmup_recorded`, `warmup_scored`, `focus_selected`, `task_generated` → step 2; see **FRONTEND-FLOW-AND-CHANGES.md** for the full alias table). No field-based step inference. When status is missing or unknown **and** has_active_session is true, show a user-facing error (“Session status could not be determined. Please refresh.”) and a **Refresh** action that calls GET status again and applies; do not default to step 1 silently.
- **Completed not active:** When status is `completed`, do not treat as an active session: on load, clear state and call POST start so the user starts a new session.
- **Warm-up text (strict):** `warmUpText = response.warm_up_task?.text ?? response.session?.warm_up_task_text ?? ""`. There is **no default warm-up text**. `warm_up_task` in status may be null. If step is 1 and warmUpText is empty, show a blocking message (“Warm-up prompt unavailable. Please refresh.”) and a **Refresh** button; do not show placeholder or fallback text.
- **Task block (step 2):** Prefer snapshot from `session.session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3`. Call GET task-block **only as fallback** when those are missing (e.g. after refresh). Do not rely on task-block if snapshots exist.
- **Final task text:** `finalTaskText = response.session?.final_task_text ?? response.final_task_text ?? ""`. Do not rely on `final_task` object only.
- **Report text:** `reportText = response.report_text ?? response.session?.context_long ?? ""`. If still empty on step 5, show “Report pending.”
- **Performance score (end):** `performanceScoreEnd = response.performance_score_end ?? response.session?.performance_score_end`.
- **Step 4 questions:** Status often has only `post_question_ids`. When step is 4 and questions are empty, call **GET questions** and set questions from that response.
- **Snake_case:** Backend uses snake_case. Frontend either reads snake_case or normalizes once in applyStatusToState and uses camelCase elsewhere.

---

## 5. Key contracts (summary)

- **Recording upload:** Get **bucket** and **storage_path** from recording-upload-url; upload blob to Supabase; then POST recording-1/2 with **JSON** body (e.g. storage_path, duration_seconds), not FormData. Call recording-upload-url for recording "1" only on step 1, for "2" only on step 3.
- **Recording_2 duration:** Backend enforces **1–5 minutes** (60–300 s; runtime may return min_seconds: 60 in 422). Frontend uses **min 62s** as buffer and validates 60–300s before upload and shows a clear message if out of range; if backend returns **422 RECORDING_DURATION_OUT_OF_RANGE**, surface that error to the user.
- **Start when no warmups:** Backend returns **422 NO_WARMUP_CONFIGURED**; no session is created. Show a clear blocking message (e.g. “Contact your coach”); do not proceed or treat as active session. Warm-up tasks are not auto-created.
- **After POST start success:** Immediately call **GET status** and apply the response to state; do not assume the start response contains the full session row.
- **Report:** Report is generated by the backend when **post-answers** are submitted (no separate POST /report). **Step 5 content comes from the POST post-answers response** (report_text, performance_score_end), not from GET status (which does not return completed sessions).
- **Metric-answers body:** Backend typically expects **q1_keywords**, **q2_emotion** (enum), **q3_cta** (or canonical answer_1/2/3). BFF or client must send the shape the backend accepts.
- **Wheel (dartboard):** Strength and pace are **client-side only** (useRealtimeStrengthPace, AnalyserNode). Start the update interval only after `ctx.resume()` so the analyser gets real audio.

---

## 6. Implementation checklist (frontend/BFF)

1. **has_active_session: false** → Clear sessionId and all session-derived state; call POST start; do not call session-scoped APIs until start returns a session id.
2. **On every successful GET status** → Run applyStatusToState and **overwrite** step and all step-derived state; do not preserve the previous step.
3. **Session id** → Set from `response.session_id ?? response.session?.id`; clear when no session.
4. **Step** → Derive only from the five statuses (warm_up→1 … completed→5); no legacy statuses or field-based inference. When status is missing or unknown but session is active, show error + Refresh (do not default step silently).
5. **Warm-up, task block, final task, report, score** → Use the field mapping in §4. No default warm-up text; empty warm-up at step 1 → blocking message + Refresh.
6. **After POST start** → Call GET status and apply; do not rely on start response for session state.
7. **Step 4** → When step is 4 and questions empty, call GET questions.
8. **Step 5** → Enter step 5 only after POST post-answers succeeds; set report text and score from the **response body**. Do not refetch GET status for the report. If report text empty after mapping, show “Report pending.”
9. **Types** → Allow session_id, session.id, status, session.status, session.state, session_state, warm_up_task (may be null), warm_up_task_text, session.warm_up_task_text, task_block, session_metric_question_1/2/3, final_task_text, session.final_task_text, report_text, session.context_long, performance_score_end, session.performance_score_end, questions, has_active_session (and snake_case).

---

## 7. Components (this repo)

| Area | Path / role |
|------|-------------|
| **HomeworkFlowCard** | `src/components/homework/HomeworkFlowCard.tsx` — GET status / POST start, applyStatusToState, deriveStepFromStatus (five statuses only), refreshStatus for unknown/empty, refetch after mutations. No default warm-up text. |
| **AnswerMetricQuestionsScreen** | `src/components/homework/AnswerMetricQuestionsScreen.tsx` — Step 2: task block + metric inputs + submit. |
| **AudioRecorder** | `src/components/recording/AudioRecorder.tsx` — Steps 1 & 3: record → blob, upload; StrengthPaceDartboard (wheel only). |
| **StrengthPaceDartboard** | `src/components/recording/StrengthPaceDartboard.tsx` — Wheel: strength + pace (useRealtimeStrengthPace). |
| **useRealtimeStrengthPace** | `src/hooks/useRealtimeStrengthPace.ts` — Mic → AnalyserNode; interval only after ctx.resume(). |
| **homework-client** | `src/lib/api/homework-client.ts` — GET status, POST start, recording-upload-url, uploadRecording1/2, metric-answers, recording-2, questions, post-answers. |
| **BFF routes** | `src/app/api/homework/session/status`, `start`, `[sessionId]/recording-upload-url`, `recording-1`, `recording-2`, `metric-answers`, `questions`, `post-answers`, `task-block`. |

---

## 8. What could go wrong

- **409 wrong step** — Drive step only from GET status; call recording-1 only when status is `warm_up`; after each mutation, refetch status and apply.
- **Stale step** — On every successful GET status, overwrite step and state; do not preserve previous step.
- **No session id / has_active_session: false** — Clear state and POST start before step 1.
- **Status is completed on load** — Do not treat as active; clear state and call POST start so the user begins a new session.
- **Empty warm-up / task block / final task / report** — Use mapping in §4; no default warm-up string (empty warm-up at step 1 → “Warm-up prompt unavailable. Please refresh.” + Refresh). Step 5 fallback “Report pending.”
- **Status missing or unknown** — Show “Session status could not be determined. Please refresh.” and Refresh (calls GET status and apply); do not default to step 1 silently.
- **Step 4 questions missing** — Call GET questions when step is 4 and questions empty.
- **Recording upload fails** — Check bucket/path, Supabase RLS/CORS; use JSON for POST recording-1/2.
- **422 RECORDING_DURATION_OUT_OF_RANGE** — Recording_2 must be 1–5 min; show message and re-record if needed.
- **422 NO_WARMUP_CONFIGURED** — Show message (e.g. “Contact your coach”); do not treat as active session.
- **Wheel not moving** — Start interval only inside `ctx.resume().then(...)`; guard `if (!stream?.active) return` in start(stream); only read analyser when `ctx.state === "running"`.
- **403 / 404** — Backend admin check; frontend uses correct paths; BFF routes exist.

**Error codes (backend):** NO_ACTIVE_SESSION, NO_WARMUP_CONFIGURED, INVALID_STATE, RECORDING_DURATION_OUT_OF_RANGE, VALIDATION_ERROR, TRANSCRIPTION_FAILED, etc. Frontend should handle 422/409 and show clear messages.

---

## 9. Debugging 409 and session state transitions

To ensure the flow follows the intended sequence, verify that the **backend state machine** matches the **desired flow**. The frontend derives step only from **GET session/status**; if the backend returns a different status than expected after a mutation, you get **409** (e.g. on recording-upload-url or recording-1/2).

### 9.1 Flow → backend status (taskmaster canonical)

| Step | Name            | Backend status (`status`)   | Allowed action |
|------|-----------------|----------------------------|----------------|
| 1    | Warm-up         | `warm_up`                  | POST recording-upload-url ("1"), then POST recording-1 |
| 2    | Metric answers  | `task_block`               | POST metric-answers |
| 3    | Final task      | `final_task_ready`         | POST recording-upload-url ("2"), then POST recording-2 |
| 4    | Post-questions  | `post_questions`           | GET questions, POST post-answers |
| 5    | Report          | `completed`               | View report (from post-answers response; GET status does not return completed) |

**Note:** Taskmaster uses `post_questions` (step 4) and `completed` (step 5). If the backend uses different names (e.g. `post_task`, `finished`), the frontend will not map them to steps 4/5 unless the backend sends these exact values or the frontend mapping is extended.

### 9.2 How to debug (frontend)

In **DevTools → Network**, filter by `status` or `recording`.

1. **After Recording 1:** Check response of **GET session/status**. **Expect:** `status: "task_block"`. If it stays `warm_up` or jumps to `completed`, the backend transition after POST recording-1 is wrong.
2. **After metric answers (step 2):** Check response after **POST metric-answers**. **Expect:** `status: "final_task_ready"`. If it stays `task_block`, you will get **409** when requesting recording-upload-url ("2") or POST recording-2, because the backend still thinks the user is on step 2.
3. **After Recording 2:** Check **GET session/status**. **Expect:** `status: "post_questions"` (or step 5 if no post-questions). If the backend returns `completed` immediately and you need step 4 (post-questions), the backend must support a `post_questions` (or equivalent) state before `completed`.

### 9.3 If you see 409 on the second recording

1. **Refresh the page** (forces GET status).
2. **Look at the UI after refresh:**
   - **Shows Questions tab (step 2)?** → Backend is still in `task_block`. **POST metric-answers** may have returned 200 but did not transition to `final_task_ready`. Fix: backend must persist state to `final_task_ready` when metric-answers are submitted.
   - **Shows Report (step 5)?** → Backend thinks the session is already `completed` (e.g. skipped step 4 or transitioned too early).
   - **Stays on Recording 2 screen?** → Upload or recording-2 request may have failed for a different reason; check response body of recording-upload-url and POST recording-2.

### 9.4 Request for the backend team

> "Please verify the **state transition table** for the homework session. The frontend expects:
> 1. `warm_up` → after POST recording-1 → `task_block`
> 2. `task_block` → after POST metric-answers → `final_task_ready`
> 3. `final_task_ready` → after POST recording-2 → `post_questions` (or `completed` if no post-questions)
> 4. `post_questions` → after POST post-answers → `completed`
>
> I am seeing **409 Conflict** on recording-upload-url or recording-2. Please confirm that after submitting metric answers (step 2), the session status becomes `final_task_ready`. If it does not, the frontend cannot proceed to Recording 2."

---

## 10. What is missing

### Backend (other repo)

- **Homework endpoints** — Backend must implement: GET/POST session/status, session/start, recording-upload-url, recording-1, recording-2, metric-answers, questions, post-answers (and optionally task-block). Until then, the frontend may show a friendly error or use BFF mock when `MOCK_HOMEWORK_BACKEND=1`.
- **Warm-up selection** — Algorithm (e.g. last score, max_performance_score, anti-repetition, tags) is defined in the backend spec; not in this repo.
- **Focus task selection** — Simple Unlock (min_task_score ≤ score_1, snapshot to session) is backend-only.
- **Scoring** — score_1 (3 metrics), score_2 (5 metrics), performance_score_end formula (e.g. average or weighted with task_execution_score), and optional score_transcription/task_execution_score are backend-only. No columns or formulas in this repo.
- **Report generation** — OpenAI (or other) report and storage in context_long / report_id is backend-only.
- **Transcript retrieval** — GET /v2/recordings/{id} (404 for not found/not allowed) and BFF proxy are optional; frontend may call GET /api/recordings/{id} to show full transcript when needed.

### Frontend / BFF (this repo)

- **Metric-answers shape** — Ensure request body matches backend (q1_keywords, q2_emotion, q3_cta or answer_1/2/3); map response if backend returns different keys.
- **3 vs 2 metric questions** — Spec says 3 pre-questions (Q1 keywords, Q2 emotion, Q3 CTA). If UI or API still use 2 inputs, align to 3 where backend expects 3.
- **Abandon / start over** — If “abandon session” or “start over” exists, it should clear local state and either call a backend abandon endpoint or rely on POST start returning a new session when appropriate.

### Not in scope (MVP)

- No separate POST /report; report is produced in post-answers.
- No transcript in GET status payload (full transcript via GET recordings/{id} if implemented).
- No Claude; no embeddings; no multi-language; no retroactive rescores; admin edits affect next session only.

---

## 10. Backend spec alignment

The **full backend MVP spec** (CONTRACT-HOMEWORK-FLOW, scoring, migrations, OpenAPI) lives in the **backend repo**. In this folder, **ALIGNMENT-WITH-BACKEND-SPEC.md** summarizes where taskmaster and that spec align vs differ.

---

## 11. Frontend: what is needed / audit checklist

Use this section for a line-level audit of the frontend against the taskmaster contracts. Key files to audit: `HomeworkFlowCard.tsx`, `homework-client.ts`, `AnswerMetricQuestionsScreen.tsx`, `AudioRecorder.tsx`, and all routes under `src/app/api/homework/session/**`.

### Already done (glow removed + audit fixes)

- **No glow / no PCM chunk:** useChunkMetrics, AmbientGlowCircle, pcm-chunk-pipeline, chunk-metrics-types, glow-color, and pcm-chunk-processor.js are **deleted**. AudioRecorder has no sessionId/recordingSlot, no chunk pipeline, no calls to recording-metrics-chunk. BFF route `recording-metrics-chunk` is **deleted**. homework-client.ts does not call recording-metrics-chunk. Recorder shows **wheel only** (useRealtimeStrengthPace). During recording, network calls are only: recording-upload-url, Supabase Storage upload, POST recording-1/2.
- **Status → step:** Step derived only from the five canonical statuses; no legacy or field-based inference. When status is missing/unknown, show error + Refresh (no silent step 1). On load, when status is `completed`, session is not treated as active (state cleared, POST start called).
- **Warm-up (strict):** No default warm-up text; warm-up from status only (`warm_up_task?.text ?? session.warm_up_task_text`). If step 1 and warmUpText empty, show “Warm-up prompt unavailable. Please refresh.” + Refresh. After POST start success, call GET status and apply (do not rely on start response for session state).
- **Task block:** Prefer session snapshots (session_metric_question_1/2/3); GET task-block only as fallback when missing. No warm-up-task helper in frontend.
- **Recording_2 duration:** Client validates 60–300s before upload and shows message if out of range; backend 422 RECORDING_DURATION_OUT_OF_RANGE is surfaced.
- **Sanity check:** `rg -n "ChunkMetrics|recording-metrics-chunk|pause_score|pause_detected|AmbientGlowCircle|glow" src` should find no matches in app code (comments in bff.ts are generic).

### Contract items to verify (punch list)

| Area | Contract | Verify in |
|------|----------|-----------|
| **Status → step** | Step derived **only** from GET status → `session.status` (or equivalent). On every successful status fetch: **overwrite** step and all step-derived state (no "preserve previous step"). | HomeworkFlowCard |
| **Session identity** | `sessionId = res.session_id ?? res.session?.id`. When `has_active_session: false`: clear session state; **do not** call session-scoped endpoints until POST start returns a session id. Completed sessions not treated as active. | HomeworkFlowCard, homework-client |
| **Field mapping** | Warm-up: `warm_up_task.text` or `session.warm_up_task_text`. Step 2: build from `session_metric_question_1/2/3`. Final task: `session.final_task_text`. Report: `session.context_long`; fallback "Report pending." Score: `session.performance_score_end`. Snake_case allowed. | HomeworkFlowCard, applyStatusToState |
| **Mutations + refetch** | After recording-1, metric-answers, recording-2, post-answers: **refetch status** and apply (overwrite state). | HomeworkFlowCard, handlers |
| **Recording contract** | Flow: recording-upload-url → Supabase upload → POST recording-1/2 with **JSON** body (storage_path, duration_seconds), not FormData. recording_2 duration 60–300s; show/forward backend error if out of range. | homework-client, AudioRecorder |
| **Step 4 questions** | If step === 4 and questions empty: GET `.../questions`. | HomeworkFlowCard |

### BFF routes (required for same-origin frontend)

Frontend calls only `/api/homework/...`. These BFF routes must exist and proxy to backend: status, start, recording-upload-url, recording-1, recording-2, metric-answers, questions, post-answers, task-block (optional). No recording-metrics-chunk route.

---

## 12. Other taskmaster files

| File | Purpose |
|------|---------|
| **prd.txt** | Product requirements and roadmap; parse with task-master to generate tasks. |
| **schema.sql** | Supabase schema reference (if present). |
| **ALIGNMENT-WITH-BACKEND-SPEC.md** | Alignment table: taskmaster vs backend consolidated spec. |
| **README.md** | Index of this folder. |

**No other docs in this project are the source of truth for the app.** All app description, flow, contracts, and “what is missing” are in this file and the files listed above.
