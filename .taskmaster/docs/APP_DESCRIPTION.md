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
| 1    | Warm-up        | Records warm-up; sees wheel + optional glow | `warm_up`          | GET status, recording-upload-url (rec "1"), Storage upload, POST recording-1; wheel = client-side strength/pace; glow = recording-metrics-chunk → pause_score |
| 2    | Metric answers | Answers 3 questions (Q1 keywords, Q2 emotion, Q3 CTA) | `task_block`       | GET status, GET task-block (optional), POST metric-answers |
| 3    | Final task     | Records final task (1–5 min); wheel + optional glow  | `final_task_ready` | GET status, recording-upload-url (rec "2"), upload, POST recording-2 |
| 4    | Post-questions | Answers reflective Qs (must answer all if any exist) | `post_questions`   | GET status, GET questions, POST post-answers |
| 5    | Report         | Views report and score      | `completed`        | GET status (report from session.context_long, score from performance_score_end) |

- **After every step-advancing action** (recording-1, metric-answers, recording-2, post-answers), the frontend calls **GET session/status** again and applies the response (applyStatusToState) so the UI stays in sync.
- **Active session:** GET status returns only in-progress sessions. **Completed** sessions must not be returned as active; after completion, the next load gets no active session and the frontend calls POST start for a new one.

---

## 3. API paths (frontend vs backend)

- **Frontend** calls **same-origin** paths only (no `v2` in URL):
  - **Homework:** `/api/homework/session/status`, `/api/homework/session/start`, `/api/homework/session/[sessionId]/recording-upload-url`, `recording-1`, `recording-2`, `metric-answers`, `questions`, `post-answers`, `recording-metrics-chunk`, `task-block`.
  - **Admin:** `/api/admin/*` (students, tasks, warm-up-tasks, post-recording-questions, metrics, etc.)
- **BFF** proxies to backend with **Authorization: Bearer &lt;supabase_access_token&gt;**:
  - Homework → `BASE_URL/v2/homework/session/status`, `.../start`, `.../session/:id/recording-1`, etc.
  - Admin → `BASE_URL/v2/admin/*`
- **Backend** serves `/v2/homework/*`, `/v2/admin/*`. Base URL from `NEXT_PUBLIC_API_URL` (or `NEXT_PUBLIC_BACKEND_URL` / `BACKEND_URL`). **Mock:** If `NEXT_PUBLIC_API_URL` is unset or `MOCK_HOMEWORK_BACKEND=1`, the BFF can return stub JSON so the flow runs without a backend.

---

## 4. GET session/status — response shape and mapping

- **Response:** Either `{ has_active_session: false, session: null }` or `{ has_active_session: true, session_id: "<uuid>", session: <object> }`. The `session` object is often the raw **v2_sessions** row (snake_case). Backend may send top-level fields or nest under `session`.
- **Session id:** `sessionId = response.session_id ?? response.session?.id ?? null`. No session-scoped calls without a valid sessionId.
- **Status → step:** Read status from `response.status ?? response.session?.status ?? response.session?.state ?? response.session_state ?? ""`, then map: `warm_up`→1, `task_block`→2, `final_task_ready`→3, `post_questions`→4, `completed`→5. Use **only** this to set the step when status is present.
- **Warm-up text:** `warmUpText = response.warm_up_task?.text ?? response.warm_up_task_text ?? response.session?.warm_up_task_text ?? ""`.
- **Task block (step 2):** Backend often does **not** send a shaped `task_block`. Build from `session_metric_question_1`, `session_metric_question_2`, `session_metric_question_3` (top-level or under `session`). Call GET task-block only if those are missing **and** the backend exposes that route.
- **Final task text:** `finalTaskText = response.session?.final_task_text ?? response.final_task_text ?? ""`. Do not rely on `final_task` object only.
- **Report text:** `reportText = response.report_text ?? response.session?.context_long ?? ""`. If still empty on step 5, show “Report pending.”
- **Performance score (end):** `performanceScoreEnd = response.performance_score_end ?? response.session?.performance_score_end`.
- **Step 4 questions:** Status often has only `post_question_ids`. When step is 4 and questions are empty, call **GET questions** and set questions from that response.
- **Snake_case:** Backend uses snake_case. Frontend either reads snake_case or normalizes once in applyStatusToState and uses camelCase elsewhere.

---

## 5. Key contracts (summary)

- **Recording upload:** Get **bucket** and **storage_path** from recording-upload-url; upload blob to Supabase; then POST recording-1/2 with **JSON** body (e.g. storage_path, duration_seconds), not FormData. Call recording-upload-url for recording "1" only on step 1, for "2" only on step 3.
- **Recording_2 duration:** Backend enforces **1–5 minutes** (60–300 s). If out of range → **422 RECORDING_DURATION_OUT_OF_RANGE**.
- **Start when no warmups:** Backend returns **422 NO_WARMUP_CONFIGURED**; no session is created. Show a clear message; do not treat as active session.
- **Report:** Report is generated by the backend when **post-answers** are submitted (no separate POST /report). Step 5 content comes from GET status.
- **Metric-answers body:** Backend typically expects **q1_keywords**, **q2_emotion** (enum), **q3_cta** (or canonical answer_1/2/3). BFF or client must send the shape the backend accepts.
- **Wheel (dartboard):** Strength and pace are **client-side only** (useRealtimeStrengthPace, AnalyserNode). Start the update interval only after `ctx.resume()` so the analyser gets real audio.
- **Glow (pause_score):** POST PCM chunks to same-origin BFF `.../recording-metrics-chunk`. Response **pause_score** (0–1) drives glow brightness (useChunkMetrics → AmbientGlowCircle). Optional red dot from **pause_detected**.

---

## 6. Implementation checklist (frontend/BFF)

1. **has_active_session: false** → Clear sessionId and all session-derived state; call POST start; do not call session-scoped APIs until start returns a session id.
2. **On every successful GET status** → Run applyStatusToState and **overwrite** step and all step-derived state; do not preserve the previous step.
3. **Session id** → Set from `response.session_id ?? response.session?.id`; clear when no session.
4. **Step** → Derive only from status (warm_up→1 … completed→5); fallbacks only when status is missing or unknown.
5. **Warm-up, task block, final task, report, score** → Use the field mapping in §4.
6. **Step 4** → When step is 4 and questions empty, call GET questions.
7. **Step 5** → If report text empty after mapping, show “Report pending.”
8. **Types** → Allow session_id, session.id, status, session.status, session.state, session_state, warm_up_task, warm_up_task_text, session.warm_up_task_text, task_block, session_metric_question_1/2/3, final_task_text, session.final_task_text, report_text, session.context_long, performance_score_end, session.performance_score_end, questions, has_active_session (and snake_case).

---

## 7. Components (this repo)

| Area | Path / role |
|------|-------------|
| **HomeworkFlowCard** | `src/components/homework/HomeworkFlowCard.tsx` — GET status / POST start, applyStatusToState, deriveStepFromStatus, refetch after mutations. |
| **AnswerMetricQuestionsScreen** | `src/components/homework/AnswerMetricQuestionsScreen.tsx` — Step 2: task block + metric inputs + submit. |
| **AudioRecorder** | `src/components/recording/AudioRecorder.tsx` — Steps 1 & 3: record → blob, upload; StrengthPaceDartboard; useChunkMetrics (glow) when sessionId + recordingSlot set. |
| **StrengthPaceDartboard** | `src/components/recording/StrengthPaceDartboard.tsx` — Wheel: strength + pace (useRealtimeStrengthPace). |
| **useRealtimeStrengthPace** | `src/hooks/useRealtimeStrengthPace.ts` — Mic → AnalyserNode; interval only after ctx.resume(). |
| **useChunkMetrics** | `src/hooks/useChunkMetrics.ts` — PCM → recording-metrics-chunk → pause_score → glowColor. |
| **AmbientGlowCircle** | `src/components/recording/AmbientGlowCircle.tsx` — Glow from glowColor (optional in recorder UI). |
| **homework-client** | `src/lib/api/homework-client.ts` — GET status, POST start, recording-upload-url, uploadRecording1/2, metric-answers, recording-2, questions, post-answers. |
| **BFF routes** | `src/app/api/homework/session/status`, `start`, `[sessionId]/recording-upload-url`, `recording-1`, `recording-2`, `recording-metrics-chunk`, `metric-answers`, `questions`, `post-answers`, `task-block`. |

---

## 8. What could go wrong

- **409 wrong step** — Drive step only from GET status; call recording-1 only when status is `warm_up`; after each mutation, refetch status and apply.
- **Stale step** — On every successful GET status, overwrite step and state; do not preserve previous step.
- **No session id / has_active_session: false** — Clear state and POST start before step 1.
- **Empty warm-up / task block / final task / report** — Use mapping in §4; step 5 fallback “Report pending.”
- **Step 4 questions missing** — Call GET questions when step is 4 and questions empty.
- **Recording upload fails** — Check bucket/path, Supabase RLS/CORS; use JSON for POST recording-1/2.
- **422 RECORDING_DURATION_OUT_OF_RANGE** — Recording_2 must be 1–5 min; show message and re-record if needed.
- **422 NO_WARMUP_CONFIGURED** — Show message (e.g. “Contact your coach”); do not treat as active session.
- **Wheel not moving** — Start interval only inside `ctx.resume().then(...)`; guard `if (!stream?.active) return` in start(stream).
- **Glow not visible** — Ensure chunk pipeline runs when recording and render AmbientGlowCircle with chunkMetrics.glowColor if glow is desired.
- **403 / 404** — Backend admin check; frontend uses correct paths; BFF routes exist.

**Error codes (backend):** NO_ACTIVE_SESSION, NO_WARMUP_CONFIGURED, INVALID_STATE, RECORDING_DURATION_OUT_OF_RANGE, VALIDATION_ERROR, TRANSCRIPTION_FAILED, etc. Frontend should handle 422/409 and show clear messages.

---

## 9. What is missing

### Backend (other repo)

- **Homework endpoints** — Backend must implement: GET/POST session/status, session/start, recording-upload-url, recording-1, recording-2, metric-answers, questions, post-answers (and optionally task-block, recording-metrics-chunk). Until then, the frontend may show a friendly error or use BFF mock when `MOCK_HOMEWORK_BACKEND=1`.
- **Warm-up selection** — Algorithm (e.g. last score, max_performance_score, anti-repetition, tags) is defined in the backend spec; not in this repo.
- **Focus task selection** — Simple Unlock (min_task_score ≤ score_1, snapshot to session) is backend-only.
- **Scoring** — score_1 (3 metrics), score_2 (5 metrics), performance_score_end formula (e.g. average or weighted with task_execution_score), and optional score_transcription/task_execution_score are backend-only. No columns or formulas in this repo.
- **Report generation** — OpenAI (or other) report and storage in context_long / report_id is backend-only.
- **Transcript retrieval** — GET /v2/recordings/{id} (404 for not found/not allowed) and BFF proxy are optional; frontend may call GET /api/recordings/{id} to show full transcript when needed.

### Frontend / BFF (this repo)

- **Glow in recorder UI** — useChunkMetrics runs and glowColor is available, but **AmbientGlowCircle is not rendered** in AudioRecorder; to show the glow during recording, add it with chunkMetrics.glowColor.
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

## 11. Other taskmaster files

| File | Purpose |
|------|---------|
| **prd.txt** | Product requirements and roadmap; parse with task-master to generate tasks. |
| **schema.sql** | Supabase schema reference (if present). |
| **ALIGNMENT-WITH-BACKEND-SPEC.md** | Alignment table: taskmaster vs backend consolidated spec. |
| **README.md** | Index of this folder. |

**No other docs in this project are the source of truth for the app.** All app description, flow, contracts, and “what is missing” are in this file and the files listed above.
