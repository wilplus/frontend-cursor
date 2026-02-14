# Frontend flow: current behavior and what changed

See APP_DESCRIPTION.md for full taskmaster. For the **end report panel** (audio player + scores chart + report text), see `docs/PLAN-END-REPORT-PANEL.md`; backend API in backend-cursor `.taskmaster/docs/PLAN-END-REPORT-PANEL.md`. This doc summarizes (1) how the frontend flow looks now and (2) what changed. **Aligned with backend:** Step 5 is driven by the **post-answers response** only; GET status does not return completed sessions (see backend repo FLOW-AND-CHANGES.md).

## 1. Current frontend flow (step-by-step)

| Step | UI | Status (canonical or alias) | Behavior |
|------|-----|-----------------------------|----------|
| 0 | Start | — | POST start → GET status → apply |
| 1 | Warm-up record | warm_up | AudioRecorder min 60s; timer in onstart; Stop disabled until min |
| 2 | Metric Qs (3) | task_block (+ aliases) | AnswerMetricQuestionsScreen; POST metric-answers → GET status |
| 3 | Final record | final_task_ready (+ aliases) | AudioRecorder min 62s; onstart first+resume; Stop disabled until 62s |
| 4 | Reflective Qs | post_questions (+ aliases) | PostQuestionsStepScreen (local state); submit(answersFromChild) |
| 5 | Report | **post-answers response** (not GET status) | Report + score from **POST post-answers response** (report_text, performance_score_end). **Single CTA:** one button only — "Start new homework". **Progress bar** at **top** for all steps (1–5), including step 5. Frontend does **not** block step 5 on GET status — backend does not return completed sessions from GET status. |

Step 4: StepFlowWrapper (stable). handlePostAnswersSubmit(answersFromChild) → POST post-answers. On success, frontend sets report and score from the **response** and setStep(5); no GET status call required for step 5. Debug: debugIngest() only when NODE_ENV=development.

**Step 5 UI:** One button only — "Start new homework" (no "Back to dashboard"). Progress bar (ProgressStepBullets) is rendered at the **top** by StepFlowWrapper for **all** steps (1–5); step 5 shows the same layout: progress bar → report card (title, score, report text, button).

**Step 5 report screen (current spec):**
- One button only: **"Start new homework"** (no "Back to dashboard").
- Progress bar at **top** for every step (1–5), including the report step.
- "Start new homework" resets the homework session to step 0 (same "Homework" card as after login) without logging the user out; calls abandonSession, clears all state and storage; button shows "Resetting…" while handling.

## 2. Step 4 → 5 (aligned with backend)

- **POST post-answers** returns report payload (report_text, performance_score_end).
- Frontend **immediately** transitions to step 5 using that response (setReportText, setPerformanceScoreEnd, setStep(5)).
- **Do not block step 5 on GET status** — backend GET status does not return completed sessions.
- Optional: you may refetch GET status for consistency, but the user must see the report from the post-answers response.

## 3. Status aliases (for steps 1–4 resume)

After recording 1 backend may return warmup_recorded, warmup_scored, focus_selected, task_generated → we map to step 2. Similarly step 3/4 aliases. **Step 5 is entered from the post-answers response**, not from status; the "completed" / step-5 aliases in the table below are for edge cases (e.g. refresh or if backend ever returns completed in status).

## 4. UI step floor (monotonic progression)

To avoid the UI snapping back when GET status is stale (eventual consistency), the frontend uses a **step floor** instead of overriding server status:

- **serverStatus** = whatever GET status returns (source of truth from backend).
- **uiStepFloor** = minimum step the UI is allowed to show after a confirmed step-advancing mutation.
- **Displayed step** = `max(stepFromServerStatus, uiStepFloor)`.

**When the floor is set:** On success of recording-1 → `uiStepFloor = max(uiStepFloor, 2)`; metric-answers → `max(uiStepFloor, 3)`; recording-2 → `max(uiStepFloor, 4)`. Then refetch GET status and apply; the applied step is clamped so the UI never goes backward.

**Post-answers:** Step 5 and report are set from the **post-answers response** only; the floor is not used for step 5 (report screen is not driven by GET status).

**When the floor is reset to 0:** No active session (e.g. load with no session or completed); user clicks “Start new homework” (handleStartOver); abandon session and end with no session; **session-gone (404)** from any homework API → startOverFromScratch(); any path that clears sessionId and sets step to 0.

**Sync behind:** If GET status remains behind the floor for a long time (e.g. 10–30s), this can be treated as a sync problem: show “Syncing…” or retry GET status (optional; not yet implemented).

## 4.5 Auth and session (shared links, persistence)

- **Protected routes:** Middleware validates session (`getUser()`) for `/dashboard`, `/profile`, `/recordings`, `/change-password`, and **`/admin`**. No session → redirect to `/login?redirectTo=<path>`.
- **No auth in URL:** Middleware strips query params `access_token`, `refresh_token`, `token`, `api_key`, `supabase_key` and redirects to the same path without them so sharing a link never passes credentials.
- **Server-side safeguard:** `(protected)/layout.tsx` runs for all routes under `(protected)`; calls `getUser()`; if no user, redirects to login. So shared links open in another browser/device show login, not another user's session.
- **Persistence:** Session in cookies (Supabase SSR). Cookie options: `Secure` (prod), `SameSite: lax`, `HttpOnly`, `path: "/"`. User stays logged in until they log out.
- **Logout:** Header calls `signOut()` then `router.push("/login")`.

## 4.6 Session-gone / start-over

When the backend no longer has the user's session (e.g. expired, cleaned up, or 404), the frontend **does not block the user**: it shows one clear message and resets to step 0 so they can start a new lesson.

- **API client (`homework-client.ts`):** `HomeworkApiError` includes optional `status?: number`. On **404**, the client throws an error with `code` (e.g. `SESSION_NOT_FOUND` when the backend sends it) and `status: 404`, so the UI can reliably detect "session gone".
- **Helpers in `HomeworkFlowCard.tsx`:**
  - **`startOverFromScratch()`** — Local-only reset: abort ref, clear refs, clear sessionStorage (`homeworkReport`, `homeworkJustFinishedRecording2`), reset all homework state, set step to **0**. No API call (used when the session is already gone).
  - **`isSessionGoneError(e)`** — Returns true when `e.code === "SESSION_NOT_FOUND"`, `e.status === 404`, or the message contains "session not found" / "no active session".
- **Where session-gone is handled (toast + reset to step 0):**
  - **uploadRecording1** → `handleRecording1Complete` catch: if `isSessionGoneError(e)` → toast "Your session is gone. You can start a new lesson." → `startOverFromScratch()` → return.
  - **uploadRecording2** → `handleRecording2Complete` catch: same.
  - **submitMetricAnswers** → `handleMetricAnswersSubmit` catch: same (before RECORDING_1_FAILED / RECORDING_1_PROCESSING / INVALID_SESSION_STATE).
  - **submitPostAnswers** → `handlePostAnswersSubmit` catch: same.
  - **getReport** (useEffect when on step 5) → `.catch`: same.
- **Outcome:** For any 404 / session-not-found from these five flows, the user sees a single toast and is sent back to step 0 with no duplicate reset logic. Backend contract is unchanged; see backend repo `docs/FRONTEND-SESSION-GONE-START-OVER.md` for the single reference for both sides.

## 5. What changed

- Recording 1 → step 2: aliases so user is not thrown back to step 1.

- Step 4 form: PostQuestionsStepScreen + local state + stable wrapper; submit uses child answers.

- Recording-2: startTimeRef in recorder.onstart (first and resume); **frontend enforces min 62s** (buffer above backend; backend runtime may return min_seconds: 60). Stop disabled until min; 422 surfaced; timer reset on too-short.

- Debug ingest: single debugIngest(); no request in production. All ingest calls (including HomeworkFlowCard) use debugIngest(); NODE_ENV !== "development" → no fetch.

- **Step 5 (report):** Single button only — "Start new homework" (no "Back to dashboard"). Progress bar at **top** for all steps (1–5). "Start new homework" resets session to step 0 without logout (abandonSession, clear state/storage, idempotent with "Resetting…").

- **Mic permission:** Mic is requested only on user action. Permission request is started on **pointer down** on "Start Recording" (streamPromiseRef) so the browser treats it as same user gesture (helps Safari/iOS). On NotAllowedError, show: "Microphone was blocked. Click the lock or info icon in the address bar and set Microphone to Allow, then try again." and toast "Allow microphone in your browser (address bar → site settings)".
- **Auth / shared links:** Middleware strips auth params from URL; requires session for /dashboard and /admin; (protected) layout validates session server-side. Session in cookies with Secure, SameSite, HttpOnly so shared links do not log in another person; browser remembers user until logout.

- **Session-gone (404):** Any homework API that returns 404 (or SESSION_NOT_FOUND / "session not found" / "no active session") is treated as "session is over". Frontend shows toast "Your session is gone. You can start a new lesson." and runs `startOverFromScratch()` so the user lands on step 0 and can start a new lesson. Applied in: recording 1 upload, recording 2 upload, metric-answers submit, post-answers submit, getReport.

## 6. Status aliases (explicit list)

| Backend returns | Mapped step |
|-----------------|-------------|
| warmup_recorded, warmup_scored, focus_selected, task_generated | 2 |
| final_task, ready_for_final, final_task_ready | 3 |
| post_task, post_task_questions, reflective, recording2_uploaded, recording2_scored | 4 |
| finished, done, post_questions_done, report_generated | 5 (resume only; after submit use post-answers response) |

Canonical five: warm_up→1, task_block→2, final_task_ready→3, post_questions→4, completed→5. **Step 5 after submitting post-answers** is always from the **post-answers response**, not from GET status.

## 7. Before vs now (explicit)

| Area | Before | Now |
|------|--------|-----|
| After recording 1 | Only status `task_block` → step 2. Other (e.g. warmup_recorded) → unknown → step 1. | Aliases map warmup_recorded etc. → step 2. User reaches metric questions. |
| Step 4 form | Inline in parent; parent postAnswers; typing re-rendered parent; wrapper recreated → remount → input blocked. | PostQuestionsStepScreen (local state); StepFlowWrapper stable; no remount; submit(answersFromChild). |
| Step 4 → 5 | Doc said GET status → completed → step 5. | **Post-answers response** drives step 5 (report_text, performance_score_end); no GET status required; backend does not return completed. |
| Step 4 submit | Handler read parent postAnswers (empty when form in child). | handlePostAnswersSubmit(answersFromChild); payload from child; POST post-answers correct. |
| Recording-2 timer | startTimeRef on click; recorder.start() after; resume set startTime before start(). Gap → UI 60s, blob ~58s → 422. | startTimeRef in recorder.onstart (first start and resume); Math.floor duration; min 62s; Stop disabled until elapsed ≥ min. |
| Recording-2 422 | Not clearly surfaced. | RECORDING_DURATION_OUT_OF_RANGE → message with min/max and "You recorded Xs". |
| Too-short recording | Stop allowed; toast; timer showed e.g. "00:06 remaining" next. | Stop disabled until min; on reject setElapsedSeconds(0) → "01:00 remaining". |
| Debug ingest | Inline fetch to 127.0.0.1:7242/7243 in several files; CORS in prod. | debugIngest(url, payload); NODE_ENV !== "development" → return; no request in prod. |
| Step 5 report UI | Two buttons (Back to dashboard, Start new homework); progress bar on all steps (top). | Single button "Start new homework" only; progress bar at top for all steps (1–5). "Start new homework" resets to step 0 without logout. |
| Mic permission | getUserMedia on click only. | Request started on **pointer down** (same user gesture); clearer NotAllowedError copy (address bar → allow mic). |
| Auth / shared links | Possible token in URL; /admin allowed without session check. | Auth params stripped from URL; session required for /admin; (protected) layout validates session; cookies Secure/SameSite/HttpOnly; shared link in another device → login. |
| Session gone (404) | Errors could leave user stuck or show generic messages. | Client sets `status: 404` and `code` on 404; `isSessionGoneError()` + `startOverFromScratch()` in recording 1/2, metric-answers, post-answers, getReport → one toast and reset to step 0. |
