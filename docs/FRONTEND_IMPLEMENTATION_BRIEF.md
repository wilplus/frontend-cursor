# Frontend Implementation Brief (Codebase Snapshot)

Structured snapshot for another LLM to generate new features without breaking conventions. **Report only — no proposed changes.**

---

## 1) High-level summary (bullets)

- **Framework:** Next.js 14 (App Router), React 18, TypeScript. Styling: Tailwind CSS. No form library (plain React state). UI: Radix Slot + custom primitives (button, card, input, alert-dialog, progress components), Lucide icons, Sonner toasts.
- **State:** Zustand (`src/store/session-store.ts`) for the full session/recording flow (idle → pre_questionnaire → pre_questions → command_select → recording_ready → recording → recorded → uploading_processing → post_questions → finalizing → completed). No Redux, React Query, or SWR.
- **Auth:** Supabase (`@supabase/ssr`). Browser client: `src/lib/supabase/client.ts` (createBrowserClient). Server: `src/lib/supabase/server.ts` (createServerSupabaseClient with cookies). Session stored in cookies (Supabase default); token obtained via `supabase.auth.getSession()` / `getUser()`.
- **Login:** `src/app/(auth)/login/page.tsx` + `src/components/auth/LoginForm.tsx` — `signInWithPassword`, then `fetch("/api/auth/confirm-session")` to sync httpOnly cookies. Redirect from `redirectTo` query or `/dashboard`.
- **Protected routes:** Middleware (`middleware.ts`) checks `getUser()`; redirects unauthenticated users from `/dashboard`, `/profile`, `/recordings`, `/change-password` to `/login?redirectTo=...`. Admin `/admin` and `/recordings/.../feedback` allowed; backend verifies admin. No role in JWT; **isAdmin** is determined by **calling backend** — `AdminAuthGuard` calls `fetchAdminRecordings(1,0)`; 403/401 → not admin, redirect or show "Access Denied".
- **Backend integration:** All backend calls go through **Next.js API routes (BFF)**. Env: `NEXT_PUBLIC_API_URL` (Flask backend). Client uses `src/lib/api/client.ts`: `getAuthFetchOptions()` gets Supabase `session.access_token` and sets `Authorization: Bearer <token>`; every request uses `credentials: "include"`. BFF (`src/lib/api/bff.ts`) proxies to `BACKEND_BASE_URL` with session from cookies or Authorization header; retries on 401 after refresh. Errors: `handleResponse` throws; 502 → user-friendly "backend not responding"; toasts (Sonner) in components.
- **Session flow:** Dashboard shows `SessionCard`; flow driven by `useSessionStore`. Start session → `POST /api/session/start` (proxied to `/session/start`); pre-answers → `POST /api/pre-answers` → `/questions/pre-recording/answers`; recording upload → `POST /api/recording/upload` (multipart) → `/recordings/upload`; post-answers → `POST /api/post-answers` → `/questions/post-recording/answers`. Session status: `GET /api/session/status` → `/session/status`.
- **Recording:** Single component `src/components/recording/AudioRecorder.tsx`. Uses **MediaRecorder**; MIME priority `audio/webm;codecs=opus` | `audio/webm` | `audio/mp4` | `audio/mpeg`. Min 60s, max 300s. Upload: FormData (audio blob as `recording.webm`), `session_id`, `duration_seconds`, `command_option_id` → BFF `proxyMultipart`. No presigned URL; no built-in waveform visualization (timer only).
- **Admin:** Exists. Routes: `/admin` (dashboard with recordings list), `/admin/user/[userId]` (user context + feedback link), `/recordings/[id]/feedback` (provide feedback; admin-only via AdminAuthGuard). Reusable: `Card`, `Button`, `Input`; `AdminRecordingsList` (cards, search, pagination, filter by needs feedback).
- **Routing:** App Router only. Root layout `src/app/layout.tsx` — Toaster, no AuthProvider. Route groups: `(admin)`, `(auth)`, `(protected)`. No shared sidebar; dashboard uses `DashboardShell` + `DashboardHeader`. Home `/` redirects to `/dashboard` if logged in else `/login`.
- **Types:** `src/lib/api/types.ts` — SessionStatusResponse, PreQuestion, CommandOption, PostRecordingQuestion, RecordingMetrics, RecordingAnalysis, PerformanceScore, GetRecordingResponse, UserProfileResponse, AdminFeedbackRequest, UserAdminContext, RecordingForAdmin, etc. UUID and ISODateString aliases.
- **Conventions:** React strict mode. Lint: `next lint`. No explicit form library. `useAuthReady()` used before calling authenticated APIs to avoid race with session restore. Background upload: post-questions shown while upload continues; store holds `uploadPromise` for submit to await.

---

## 2) Route map (route → file path → purpose)

| Route | File path | Purpose |
|-------|-----------|---------|
| `/` | `src/app/page.tsx` | Server: redirect to `/dashboard` or `/login` by auth |
| `/login` | `src/app/(auth)/login/page.tsx` | Login page; renders LoginForm |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Signup page |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Reset password request |
| `/update-password` | `src/app/(auth)/update-password/page.tsx` | Set new password after recovery |
| `/auth/callback` | `src/app/auth/callback/route.ts` | Supabase OAuth/code callback; exchangeCodeForSession; redirect |
| `/dashboard` | `src/app/(protected)/dashboard/page.tsx` | Dashboard with SessionCard, DashboardFirstStep |
| `/profile` | `src/app/(protected)/profile/page.tsx` | User profile |
| `/recordings` | `src/app/(protected)/recordings/` | Recordings list (if exists) |
| `/recordings/[id]` | `src/app/(protected)/recordings/[id]/page.tsx` | User recording detail (fetchRecording, CompletedCard) |
| `/recordings/[id]/feedback` | `src/app/recordings/[id]/feedback/page.tsx` | Admin: provide feedback for a recording (user_id in query) |
| `/change-password` | `src/app/(protected)/change-password/page.tsx` | Change password |
| `/admin` | `src/app/(admin)/admin/page.tsx` | Admin dashboard; AdminAuthGuard; AdminRecordingsList |
| `/admin/user/[userId]` | `src/app/(admin)/admin/user/[userId]/page.tsx` | Admin user context (feedback, email, recordings link) |
| API: session/status | `src/app/api/session/status/route.ts` | GET → proxyJson `/session/status` |
| API: session/start | `src/app/api/session/start/route.ts` | POST → proxyJson `/session/start` |
| API: session/abandon | `src/app/api/session/abandon/route.ts` | POST → proxyJson `/session/abandon` |
| API: pre-answers | `src/app/api/pre-answers/route.ts` | POST → proxyJson `/questions/pre-recording/answers` |
| API: recording/upload | `src/app/api/recording/upload/route.ts` | POST → proxyMultipart `/recordings/upload` |
| API: post-answers | `src/app/api/post-answers/route.ts` | POST → proxyJson `/questions/post-recording/answers` |
| API: recordings/[id] | `src/app/api/recordings/[id]/route.ts` | GET → proxyJson `/recordings/:id` |
| API: recordings/[id]/audio-url | `src/app/api/recordings/[id]/audio-url/route.ts` | GET → proxyJson `/recordings/:id/audio-url` |
| API: user/recordings | `src/app/api/user/recordings/route.ts` | GET → proxyJson `/user/recordings?...` |
| API: user/profile | `src/app/api/user/profile/route.ts` | GET → proxyJson `/user/profile` |
| API: auth/confirm-session | `src/app/api/auth/confirm-session/route.ts` | POST: confirm session (cookies) |
| API: auth/logout | `src/app/api/auth/logout/route.ts` | Logout |
| API: admin/recordings | `src/app/api/admin/recordings/route.ts` | GET → proxyJson `/admin/recordings?...` |
| API: admin/feedback | `src/app/api/admin/feedback/route.ts` | POST → proxyJson `/admin/feedback` |
| API: admin/user/[userId]/context | `src/app/api/admin/user/[userId]/context/route.ts` | GET/PATCH → proxyJson `/admin/user/:userId/context` |
| API: admin/user/[userId]/auth-email | `src/app/api/admin/user/[userId]/auth-email/route.ts` | GET: Supabase admin getUserById email (server-only) |

---

## 3) Auth summary (file paths + how to get token)

- **Supabase client (browser):** `src/lib/supabase/client.ts` — `createClient()` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `createBrowserClient` from `@supabase/ssr`.
- **Supabase server:** `src/lib/supabase/server.ts` — `createServerSupabaseClient()` for RSC; cookies via `cookies()`.
- **Login:** `src/components/auth/LoginForm.tsx` — `supabase.auth.signInWithPassword({ email, password })` then `fetch("/api/auth/confirm-session", { method: "POST", credentials: "include" })`. Redirect from `redirectTo` or `/dashboard`.
- **Session/token:** Stored in cookies by Supabase. Client-side: `const { data: { session } } = await supabase.auth.getSession();` then `session.access_token`. Used in `src/lib/api/client.ts` inside `getAuthFetchOptions()` (only on client): imports Supabase client, gets session, sets `headers["Authorization"] = "Bearer " + session.access_token`.
- **Auth guard / protected routes:** `middleware.ts` — `createServerClient` with request cookies, `getUser()`. If path in PROTECTED_ROUTES and no session → redirect to `/login?redirectTo=<fullUrl>`. Admin and feedback routes allowed; backend returns 403/401 for non-admins.
- **Admin check:** `src/components/admin/AdminAuthGuard.tsx` — calls `fetchAdminRecordings(1, 0)`; success → isAdmin true; 403/401 → isAdmin false, toast + redirect to login or "Access Denied". No profile table or JWT claim for admin; backend is source of truth.
- **Auth ready hook:** `src/hooks/useAuthReady.ts` — returns true when Supabase has a session; used so API calls wait for session restore; on refresh token errors calls `signOut` and redirects to `/login`.

---

## 4) API summary (env vars + client pattern + endpoint list)

- **Env vars:** `NEXT_PUBLIC_API_URL` (Flask backend base, e.g. Railway). `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional server-only: `SUPABASE_SERVICE_ROLE_KEY` (for auth-email route).
- **Client pattern:** `src/lib/api/client.ts`. Before each request: `const { headers, credentials } = await getAuthFetchOptions();` (adds `Authorization: Bearer <access_token>` when on client). Then `fetch("/api/...", { headers, credentials: "include" })`. Response: `handleResponse<T>(res)` — if !res.ok throws Error with backend error message; 502 → "Backend server is not responding..."; 401 + UNAUTHORIZED code not redirected here (component/middleware handle).
- **BFF:** `src/lib/api/bff.ts` (server-only). `proxyJson(path, init?, req)` and `proxyMultipart(path, formData, method, req)` build URL as `BACKEND_BASE_URL + path`. Auth: from `req.headers.get("Authorization")` or `getSessionForRequest(req)` (cookies). On 401, BFF can retry with refreshed token; copies cookies to response. All Next.js API routes in `src/app/api/*` proxy to Flask using these helpers.
- **Endpoints used (client → Next API → backend path):**  
  - Session: `/api/session/status` → `/session/status`; `/api/session/start` → `/session/start`; `/api/session/abandon` → `/session/abandon`.  
  - Questions: `/api/pre-answers` → `/questions/pre-recording/answers`; `/api/post-answers` → `/questions/post-recording/answers`.  
  - Recording: `/api/recording/upload` → `/recordings/upload` (multipart); `/api/recordings/:id` → `/recordings/:id`; `/api/recordings/:id/audio-url` → `/recordings/:id/audio-url`.  
  - User: `/api/user/recordings` → `/user/recordings`; `/api/user/profile` → `/user/profile`.  
  - Admin: `/api/admin/recordings` → `/admin/recordings`; `/api/admin/feedback` → `/admin/feedback`; `/api/admin/user/:userId/context` → `/admin/user/:userId/context`.  
  - Auth: `/api/auth/confirm-session` (no proxy).

---

## 5) Recording summary (file paths + upload method)

- **Recorder component:** `src/components/recording/AudioRecorder.tsx`. Uses **MediaRecorder**; MIME detection: `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, `audio/mpeg`. Output: Blob with detected MIME (typically webm). Min duration 60s, max 300s. Timer with start/pause/stop; optional file-upload fallback if MediaRecorder unsupported. No Web Audio analyser or waveform.
- **Upload:** Client builds FormData: `audio` (blob, filename `recording.webm`), `session_id`, `duration_seconds`, `command_option_id`. Calls `uploadRecording(formData, abortController)` in `src/lib/api/client.ts` → `POST /api/recording/upload` with `getAuthFetchOptions()` and optional AbortSignal. Next route `src/app/api/recording/upload/route.ts` reads formData, calls `proxyMultipart("/recordings/upload", formData, "POST", req)`. BFF sends multipart to Flask; 60s timeout. Response JSON expected (e.g. recording_id, post_questions). No presigned URL; no base64.

---

## 6) Admin summary (exists? yes/no)

- **Exists: yes.**  
- **Routes:** `/admin` (dashboard), `/admin/user/[userId]` (user context + email, feedback link), `/recordings/[id]/feedback?user_id=...` (provide feedback form).  
- **Guard:** `AdminAuthGuard` wraps admin pages; verifies by calling `fetchAdminRecordings(1,0)`; 403/401 → access denied or redirect to login.  
- **Reusable list:** `AdminRecordingsList` — cards per recording, search (debounced, optional backend `q`), filter “Needs Feedback”, pagination, user email enrichment (getUserAdminContext/getAuthUserEmail). Buttons: View User Context, Provide Feedback.  
- **No dedicated table component;** cards + Button/Card/Input from `src/components/ui/`.

---

## 7) Key code pointers (file → one-line description)

- `src/app/layout.tsx` — Root layout; Toaster; no provider wrapper.
- `middleware.ts` — Auth check; protected/admin routes; CSP; Supabase cookie refresh.
- `src/lib/supabase/client.ts` — Browser Supabase client.
- `src/lib/supabase/server.ts` — Server Supabase client (cookies).
- `src/lib/supabase/admin.ts` — Server-only admin client (SUPABASE_SERVICE_ROLE_KEY).
- `src/lib/api/client.ts` — All client-side API calls; getAuthFetchOptions; handleResponse.
- `src/lib/api/bff.ts` — proxyJson, proxyMultipart, getSessionForRequest; forwards to Flask.
- `src/lib/api/types.ts` — API and domain types (sessions, recordings, admin, etc.).
- `src/store/session-store.ts` — Zustand store: session state machine, pre/post answers, recording blob, upload, post-questions.
- `src/hooks/useAuthReady.ts` — True when Supabase session available; used before API.
- `src/components/auth/LoginForm.tsx` — signInWithPassword + confirm-session + redirect.
- `src/components/admin/AdminAuthGuard.tsx` — Admin check via fetchAdminRecordings; redirect or deny.
- `src/components/admin/AdminRecordingsList.tsx` — Recordings list with search, filter, pagination, email enrichment.
- `src/components/dashboard/SessionCard.tsx` — Renders flow by session state; uses AudioRecorder, PreRecordingQuestionnaire, PreQuestionsForm, PostQuestionsFormV2, CompletedCard.
- `src/components/recording/AudioRecorder.tsx` — MediaRecorder; webm/mp4/mpeg; timer; FormData upload not done here (store does it).
- `src/app/auth/callback/route.ts` — Supabase code exchange; recovery → /update-password; else dashboard.
- `src/app/api/recording/upload/route.ts` — POST formData → proxyMultipart to `/recordings/upload`.
- `src/app/recordings/[id]/feedback/page.tsx` — Admin feedback form; getUserAdminContext, submitAdminFeedback; displayEmail from context or auth-email.

---

## Appendix: Session store — exact state transitions and minimal-diff rules

Use this when the other LLM implements features that touch the session flow. **Do not rewrite `src/store/session-store.ts`.** Prefer minimal diffs: add new actions or new state fields only when necessary; keep existing state names and transition order.

### SessionState enum (exact)

```ts
export type SessionState =
  | "idle"
  | "pre_questionnaire"
  | "pre_questions"
  | "command_select"
  | "recording_ready"
  | "recording"
  | "recorded"
  | "uploading_processing"
  | "post_questions"
  | "finalizing"
  | "completed";
```

### Allowed state transitions (only these)

| From | To | Trigger (action / effect) |
|------|-----|---------------------------|
| idle | pre_questionnaire | startNewSession when !questionnaireSubmitted |
| idle | command_select | startNewSession when questionnaireSubmitted + questionnaire → submitQuestionnaire → startSession |
| idle | command_select | startNewSession when questionnaireSubmitted + !questionnaire → startSession({}) |
| pre_questionnaire | command_select | submitQuestionnaire → startSession({ questionnaire }) |
| pre_questions | command_select | submitPreAnswers → submitPreAnswers() |
| command_select | recording_ready | selectCommandOption(A|B|C, promptTextSnapshot) |
| recording_ready | recording | setRecordingStart(startMs) [AudioRecorder started] |
| recording | recorded | setRecordingEnd(endMs, blob) [AudioRecorder stopped] |
| recorded | post_questions | transitionToPostQuestionsWithDefaults() then uploadRecordingBlob(..., { background: true }) — UI shows post_questions immediately |
| recorded | uploading_processing | uploadRecordingBlob() without background (legacy path) |
| uploading_processing | post_questions | uploadRecordingBlob success |
| uploading_processing | recorded | uploadRecordingBlob error (or abort) |
| post_questions | finalizing | submitPostAnswers() after validation |
| post_questions | recorded | uploadRecordingBlob error when background upload failed |
| finalizing | completed | submitPostAnswers success → fetchRecording → set completedRecording |
| finalizing | post_questions | submitPostAnswers catch |
| * | idle | abandonCurrentSession success, or reset(), or initialize() when !has_active_session, or startNewSession/submitQuestionnaire error |

Resume (initialize): status.pre_questions_completed false → **pre_questions**; status.recording_completed false → **command_select** or **recording_ready** (if saved command); status.post_questions_completed false && recording_id → **post_questions**; else recording_id → **completed**.

### Store shape (do not rename or remove)

- **State:** state, sessionId, recordingId, questionnaire, questionnaireSubmitted, cursor, mode, preQuestions, preAnswers, preAnswersSubmitted, commandOptions, selectedCommandOptionId, selectedPromptTextSnapshot, themeChosenCode, audioBlob, durationSeconds, recordingStartMs, recordingEndMs, postQuestions, postAnswers, postAnswersSubmitted, postCurrentIndex, completedRecording, loading, error, uploadPromise.
- **Actions (signatures):** initialize, submitQuestionnaire(questionnaire), startNewSession, updatePreAnswer(questionId, answer), submitPreAnswers, selectCommandOption(optionId, promptTextSnapshot), selectDifferentCommand, goBackToPreQuestionnaire, goBackToPreQuestions, goBackToCommandSelect, setRecordingReady, setRecordingStart(startMs), setRecordingEnd(endMs, blob), uploadRecordingBlob(abortController?, { background? }), transitionToPostQuestionsWithDefaults, setPostCurrentIndex(index), updatePostAnswer(questionId, answer), submitPostAnswers, finalizeSession, abandonCurrentSession, reset, forceResetLoading.

### Critical invariants

1. **Background upload:** When the user stops recording, the UI calls `transitionToPostQuestionsWithDefaults()` then `uploadRecordingBlob(controller, { background: true })`. State becomes **post_questions** immediately with `DEFAULT_POST_QUESTIONS`; when upload resolves, store updates `recordingId`, `postQuestions` (from response or default), and migrates `postAnswers` by order_index (TEMP_POST_Q1→realQuestions[0], etc.). `submitPostAnswers` must await `uploadPromise` if `recordingId` is null.
2. **Draft persistence:** Pre-answers keyed by sessionId; post-answers keyed by recordingId ?? sessionId. saveDraft/loadDraft/clearDraft use keys `willab:draft:pre_answers:${id}` and `willab:draft:post_answers:${id}`. Command selection: `willab:command_select:${sessionId}`.
3. **Post-questions:** DEFAULT_POST_QUESTIONS has 3 items (scale, binary, free_text). Backend can return post_questions in upload response; then realQuestions = response.post_questions else DEFAULT_POST_QUESTIONS. submitPostAnswers validates Q1 and Q2 required; Q3 optional; answers array includes only order_index 0, 1, and 2 if answered.
4. **Minimal diffs:** New features must not remove or rename existing SessionState values or store keys. Prefer adding optional fields or new actions that call existing ones. Do not change the order of transitions (e.g. recorded → post_questions → finalizing → completed).

### Relevant store file (reference — do not copy-paste as source of truth; repo is source of truth)

Full implementation lives in **`src/store/session-store.ts`**. The above table and invariants summarize it for prompt engineering. When in doubt, read that file and make the smallest edit that preserves all current transitions and signatures.
