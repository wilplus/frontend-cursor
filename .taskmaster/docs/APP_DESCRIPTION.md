# Willab — Unified app description

**Single source of truth** for what the app is, how the flow works, which components are involved, and what could go wrong. Use this for onboarding, task execution, and debugging. For database schema see `schema.sql`; for PRD/tasks see `prd.txt`.

---

## 1. What the app is

**Willab** is a **speech coaching app**. Students complete a **homework flow**: two voice recordings plus optional reflective questions, and receive an **AI-generated coaching report** with a performance score. Admins configure each student (warm-up tasks, focus tasks, questions) and view reports.

- **Student app:** One flow at `/dashboard`: warm-up → recording 1 → metric questions → recording 2 → (optional) reflective questions → report.
- **Admin panel:** Students list, per-student profile (homework config, speaker profile, reports), global pools (tasks, questions, metrics). Routes under `/admin/*`.
- **APIs:** Student flow uses `/api/homework/*` (BFF proxies to backend `/v2/homework/*`). Admin uses `/api/admin/*` (BFF → `/v2/admin/*`). Auth: Supabase; BFF forwards `Authorization: Bearer <token>`.

---

## 2. Flow explained

### Source of truth

**GET /api/homework/session/status** is the single source of truth for “which step the user is on.” The frontend derives step 1–5 from **session.status** (or `session.state` / `session_state`). Nothing else (URL, local state, recording IDs) overrides step when status is present.

| session.status     | Step | UI / main action |
|--------------------|------|-------------------|
| `warm_up`          | 1    | Warm-up task text + record → upload recording 1 |
| `task_block`       | 2    | Task block (context + focus + metric questions) → submit metric answers |
| `final_task_ready`| 3    | Final task text + record → upload recording 2 |
| `post_questions`  | 4    | Reflective questions (or skip) → submit post-answers |
| `completed`        | 5    | Report + performance_score_end |

### Sequence (network)

1. **Load:** GET session/status. If `has_active_session === false` (or no session id): clear state, then POST session/start. Otherwise apply status → show current step.
2. **Step 1:** Show `warm_up_task.text` (or `warm_up_task_text` / `session.warm_up_task_text`). Record → get upload URL → upload blob to Supabase → POST recording-1 with JSON `{ duration_seconds }`. On success → GET session/status → apply → step 2.
3. **Step 2:** Show task block from `task_block` or from `session_metric_question_1/2/3`. User submits two metric answers → POST metric-answers. On success → GET session/status → apply → step 3.
4. **Step 3:** Show `final_task_text` (or `session.final_task_text`). Record → upload URL → Supabase → POST recording-2. On success → GET session/status → apply → step 4.
5. **Step 4:** GET questions. If empty → skip to report. Else show form → POST post-answers. On success → GET session/status → apply → step 5.
6. **Step 5:** Show report from `report_text` or `session.context_long`; score from `performance_score_end` or `session.performance_score_end`. If report empty, show “Report pending.”

After every step-advancing success (recording-1, metric-answers, recording-2, post-answers), the frontend **refetches GET session/status** and applies the response so the UI stays in sync with the backend.

### Session id

Set from **response.session_id ?? response.session?.id**. No session-scoped calls (recording-upload-url, recording-1, etc.) without a valid sessionId.

### Field mapping (backend may send top-level or under `session`)

- **Warm-up:** `warm_up_task?.text ?? warm_up_task_text ?? session?.warm_up_task_text`
- **Task block:** `task_block` or build from `session_metric_question_1/2/3`
- **Final task:** `session?.final_task_text ?? final_task_text ?? toText(final_task)`
- **Report:** `report_text ?? session?.context_long`
- **Score:** `performance_score_end ?? session?.performance_score_end`

---

## 3. Components involved

### Frontend (student flow)

| Component | Path | Role |
|-----------|------|------|
| **HomeworkFlowCard** | `src/components/homework/HomeworkFlowCard.tsx` | Main container: on load calls GET status (or POST start), applies status via `applyStatusToState`, derives step via `deriveStepFromStatus`, renders step UI; handles refetch after mutations. |
| **AnswerMetricQuestionsScreen** | `src/components/homework/AnswerMetricQuestionsScreen.tsx` | Step 2: task block + two metric inputs + submit. |
| **AudioRecorder** | `src/components/recording/AudioRecorder.tsx` | Steps 1 & 3: mic stream, record → blob, optional real-time metrics (recording-metrics-chunk); calls homework-client upload + recording-1/2. |
| **StrengthPaceDartboard** | `src/components/recording/StrengthPaceDartboard.tsx` | Wheel UI during recording (strength/pace from `useRealtimeStrengthPace`). |
| **PostQuestionsForm / PostQuestionsFormV2** | `src/components/session/PostQuestionsForm*.tsx` | Step 4: reflective questions form. |
| **Dashboard page** | `src/app/(protected)/dashboard/page.tsx` | Renders HomeworkFlowCard. |

### Hooks & client

| Component | Path | Role |
|-----------|------|------|
| **useRealtimeStrengthPace** | `src/hooks/useRealtimeStrengthPace.ts` | Mic → AnalyserNode; starts update interval only after `AudioContext.resume()` so wheel gets real audio. |
| **homework-client** | `src/lib/api/homework-client.ts` | GET status, POST start, getRecordingUploadUrl, uploadRecording1/2 (blob + duration), metric-answers, recording-2, questions, post-answers. |
| **types-homework** | `src/lib/api/types-homework.ts` | HomeworkSessionStatus and related types (session_id, session.*, has_active_session, step fields). |

### BFF (Next.js API routes)

| Route | Path | Role |
|-------|------|------|
| GET session/status | `src/app/api/homework/session/status/route.ts` | Proxy to backend; returns status JSON. |
| POST session/start | `src/app/api/homework/session/start/route.ts` | Proxy to backend start. |
| GET recording-upload-url | `src/app/api/homework/session/[sessionId]/recording-upload-url/route.ts` | Returns Supabase signed URL for upload. |
| POST recording-1 | `src/app/api/homework/session/[sessionId]/recording-1/route.ts` | JSON body (e.g. storage path, duration); proxies to backend. |
| POST recording-2 | `src/app/api/homework/session/[sessionId]/recording-2/route.ts` | Same pattern as recording-1. |
| POST metric-answers | `src/app/api/homework/session/[sessionId]/metric-answers/route.ts` | Proxies answer_1, answer_2. |
| GET questions | `src/app/api/homework/session/[sessionId]/questions/route.ts` | Proxies to backend. |
| POST post-answers | `src/app/api/homework/session/[sessionId]/post-answers/route.ts` | Proxies answers array. |
| POST recording-metrics-chunk | `src/app/api/homework/session/[sessionId]/recording-metrics-chunk/route.ts` | Proxy for live PCM chunks (X-Chunk-Seq → X-Seq, X-Chunk-Start-Ms → X-T-Ms); 400 if sessionId missing. |

### Admin (summary)

- **Pages:** `src/app/admin/*` (students list, student profile).
- **Components:** AdminShell, student profile sections (warm-up tasks, focus tasks, post-questions, metrics, speaker profile, reports).
- **Client:** `src/lib/api/admin-client.ts`. BFF under `src/app/api/admin/*`.

---

## 4. What could go wrong

### Session / step

- **409 “Session must be in warm_up” (or wrong step):** Frontend called an endpoint (e.g. recording-1) when backend status is not the required one. **Fix:** Drive step only from GET session/status; call recording-1 only when status is `warm_up`; after each mutation, refetch status and apply.
- **Stale step (UI on 1, backend on 2):** UI kept previous step instead of overwriting from status. **Fix:** On every successful GET status, overwrite step and all step-derived state; do not preserve “previous step.”
- **No session id:** Session-scoped calls (recording-upload-url, recording-1, etc.) fail. **Fix:** Set sessionId from `session_id ?? session?.id`; guard: do not call session routes when sessionId is null.
- **has_active_session: false:** Backend says no active session. **Fix:** Clear session state and call POST session/start before showing step 1; do not reuse old sessionId.

### Backend contract / mapping

- **Empty warm-up / task block / final task / report:** Backend sends fields under different keys or nested under `session`. **Fix:** Use the mapping in §2 (warm_up_task.text, warm_up_task_text, session.warm_up_task_text; task_block or session_metric_question_1/2/3; final_task_text, session.final_task_text; report_text, session.context_long).
- **Step 5 report blank:** Backend uses `context_long` for report. **Fix:** Read `report_text ?? session.context_long`; if still empty, show “Report pending.”
- **Questions missing on step 4:** Status often does not include `questions`. **Fix:** When step is 4, call GET questions and set questions from that response.

### Upload / storage

- **Recording upload fails:** Wrong bucket/path, missing CORS, or missing Authorization on Supabase. **Fix:** Check BFF recording-upload-url response (bucket, path); ensure Supabase RLS and CORS allow the client upload; for debugging paste Request URL, status, response body, and for Storage: bucket, path, Authorization.
- **Recording-1/2 returns 4xx:** Body might expect JSON (e.g. `storage_path`, `duration_seconds`) not FormData. **Fix:** Frontend uses blob upload to Supabase then POST recording-1/2 with JSON only.

### Real-time / wheel

- **Wheel not moving:** Analyser was read while AudioContext was suspended. **Fix:** In useRealtimeStrengthPace, start the 100ms update interval only inside `ctx.resume().then(...)` so the analyser runs with a running context.
- **Stream inactive:** start(stream) called with ended stream. **Fix:** Guard with `if (!stream?.active) return` at start of start().

### Admin / auth

- **403 on admin routes:** User not in backend admin list. **Fix:** Backend checks admin_users; frontend shows appropriate message or redirect.
- **404 on /api/homework/session/start or BFF:** Wrong path or missing BFF route. **Fix:** Use `/api/homework/session/start` and `/api/homework/session/status`; ensure BFF routes exist and proxy to backend.

### Other

- **React “Objects are not valid as a React child”:** Warm-up or task block rendered as object. **Fix:** Display `warm_up_task.text` (string), not the whole object.
- **Mock vs real backend:** If NEXT_PUBLIC_API_URL unset or MOCK_HOMEWORK_BACKEND=1, BFF can return stubs. **Fix:** Point to the same backend as the GET session/status shape you implement against.

---

## 5. Student experience (summary)

- **Entry:** Dashboard loads → GET status; if no active session → POST start → step 1. Else apply status → show current step.
- **Step 1:** Warm-up text + recorder; upload recording 1 (blob + duration).
- **Step 2:** Task block (context + focus + two metric questions); submit metric answers.
- **Step 3:** Final task text + recorder; upload recording 2.
- **Step 4:** If questions returned, show form and submit; else skip to report.
- **Step 5:** Report text + performance_score_end; if report empty, “Report pending.”
- **Resume:** On later load, GET status restores session and step.

---

## 6. Admin experience (summary)

- **Students list:** GET /api/admin/students; open profile.
- **Student profile:** Overrides (assigned_next_task_ids, assigned_post_question_ids, assigned_warm_up_task_id), warm-up tasks (with max_performance_score), focus tasks, reflective questions (exactly 3), metric questions, metrics, speaker profile (coach_notes), last report, sessions history. Save via PUT overrides; Send Homework via POST send-assignment.
- **Global pools:** Tasks, post-recording questions, metrics, metric questions via /api/admin/tasks, .../post-recording-questions, .../metrics, .../metric-questions.

---

## 7. References (project root docs)

- **docs/STEPS-TO-MAKE-FLOW-WORK.md** — Numbered implementation steps and checklist.
- **docs/EXAMPLE-GET-SESSION-STATUS-RESPONSES.md** — Response shapes and contract (§4 compatible/incompatible).
- **docs/HOMEWORK_SESSION_STATUS_SOURCE_OF_TRUTH.md** — Rule and step mapping.
- **docs/BACKEND_PROMPT_API_PATHS.md** — Frontend /api vs backend /v2 paths.
- **docs/WARM_UP_SELECTION_SPEC.md** — Warm-up selection algorithm.
- **docs/BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md** — Admin API contract.
- **docs/REALTIME-METRICS-CONTRACT.md** — recording-metrics-chunk (PCM, pause_score, glow).
