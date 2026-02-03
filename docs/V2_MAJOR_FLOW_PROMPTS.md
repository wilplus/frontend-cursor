# V2 Major Flow — Copy/paste-ready prompts

This file contains three prompts for implementing the Major Flow v2 and admin expansion:

1. **PROMPT 1 — Backend** (Flask + Supabase): Flow v2 + Admin CRUD
2. **PROMPT 2 — Frontend** (Next.js + Zustand + BFF): Full v2 student flow + admin expansion
3. **PROMPT 2 (tightened)** — Frontend with HARD CONSTRAINTS: minimal diffs, v1 untouched, only allowed files

Use PROMPT 2 (tightened) when you want the other LLM to create only `session-store-v2.ts`, `/dashboard/v2`, and `SessionCardV2`, without touching v1.

---

## PROMPT 1 — Backend LLM (Flask + Supabase)

Paste this into your backend-generation LLM.

```text
You are a senior backend engineer. Extend an existing Flask backend that uses Supabase:
- Supabase Auth (email/password) with JWT Bearer tokens
- Supabase Postgres database
- Existing endpoints already used by a Next.js BFF frontend include: /session/start, /session/status, /questions/pre-recording/answers, /recordings/upload, /questions/post-recording/answers, /admin/recordings, /admin/feedback, /admin/user/:userId/context.

This is an ADDITION, not a rewrite. Do not break existing admin recordings list/feedback flow.

Goal: implement a new "Major Flow v2" for students plus a full admin management layer for exercises/tasks/questions/metrics and per-student overrides. The frontend will be updated to use the new endpoints you add.

========================
A) NEW STUDENT FLOW (v2)
========================

The new student flow is:

Step 1) Universal Questions (3 fixed questions; not editable by admin)
- Q1: mood slider 0..1 (float)
- Q2: readiness 1..10 (int) normalized to 0..1 by dividing by 10
- Q3: mode preference binary: 0 = "Guide me", 1 = "I'll choose"
We will store the question definitions in DB so copy can change via migration, but NO admin CRUD endpoints for them.

Step 2) Exercise (optional)
- Select ONE exercise from DB based on task_score.
- If there are NO ACTIVE exercises in the exercises table, SKIP this step entirely (exercise=null).
- Exercise has video_url + description text.
- Store exercise selection on session.
- Collect an "exercise liked?" boolean (yes/no). (Keep the question fixed; no pool selection.)

Step 3) Task (recording prompt)
- Select recording task(s) from DB based on task_score + mode preference:
  - If Q3=0 ("Guide me"): backend returns a single selected_task (auto).
  - If Q3=1 ("I'll choose"): backend returns 3 task options for the user to pick (anti-repeat if possible).
- Task is a prompt like "Reflect on…". These are not the same as exercises.

Step 4) Intent inputs shown under the task (these are NOT admin-editable globally, but admin can override PER STUDENT)
- intended_emotion (text)
- keywords (exactly 3 strings)
Admin can override the UI prompt text for these two fields per student; the underlying stored fields stay the same.

Step 5) Recording upload
- Student uploads audio associated with the session and selected_task.
- Transcribe using existing pipeline (keep what you have).
- Compute performance metrics (5 metrics) and performance_score.
- Note: emotion_achieved metric depends on a post-recording yes/no answer, so you may compute it at Step 6 and then finalize performance_score.

Step 6) Post-recording questions (exactly 3)
- Admin-manageable pool + ability to assign a specific set of 3 per student.
- For each session, snapshot the exact 3 question IDs used.
- One of the 3 questions MUST be the "emotion achieved?" yes/no question (admin can override text per student). Enforce this by design:
  - Either treat emotion_achieved as a special required question always included, OR enforce that the selected 3 includes a question with code='emotion_achieved_check'.
- After answers submitted: finalize metrics + performance_score (if needed), then generate concise report (existing OpenAI integration if present), store it, and make it available to admin.

========================
B) SCORING + METRICS (v2)
========================

We have exactly 5 metric codes. They are globally defined but labels are admin-editable.
Metric codes (fixed):
1) pace: from transcript WPM (normalize to 0..1 via easing; define target band e.g. 120-160 wpm => high score).
2) strength: from audio loudness RMS (server-side compute from uploaded audio; normalize to 0..1; store raw RMS/dB).
3) fillers: from transcript filler count; score high when <=3 fillers, decreasing after that (use smoothstep/logistic).
4) emotion_achieved: from post-recording yes/no answer.
5) keywords_used: from transcript; score 1 if >=2 of the 3 keywords appear (case-insensitive, word boundary), else 0 (optionally eased).

Performance_score:
- per_metric_score is 0..1
- apply easing/smoothing to continuous metrics (pace/strength/fillers) using smoothstep/logistic
- final performance_score = average of the 5 metric scores (or weighted average with weights in code constants).
- Store full breakdown JSON: raw values, normalized score, and a human-readable explanation.

IMPORTANT: metric labels are editable by admin, BUT every recording/report must snapshot the metric labels used at the time, so history doesn't change when labels are edited later.

========================
C) DATABASE CHANGES
========================

Create SQL migrations (Supabase/Postgres) adding these tables (adapt names to existing conventions; keep existing ones intact):

1) universal_questions (seed exactly 3 rows)
- id uuid pk
- code text unique (mood, readiness, mode_preference)
- text text
- answer_type text (slider_0_1, scale_1_10, binary)
- position int

2) exercises
- id uuid pk
- title text
- video_url text
- description text
- min_task_score float default 0
- max_task_score float default 1
- is_active boolean default true
- created_at timestamp

3) tasks
- id uuid pk
- title text
- prompt_text text
- min_task_score float default 0
- max_task_score float default 1
- is_active boolean default true
- created_at timestamp

4) post_recording_questions
- id uuid pk
- code text nullable unique (use for special question: 'emotion_achieved_check')
- text text
- answer_type text (yes_no | scale_1_5 | text)
- is_active boolean default true
- created_at timestamp

5) metric_definitions (global, must always have exactly 5 fixed codes)
- code text pk (pace, strength, fillers, emotion_achieved, keywords_used)
- left_label text
- right_label text
- updated_at timestamp

6) student_overrides
- user_id uuid pk (references auth user)
- intended_emotion_prompt text nullable
- keywords_prompt text nullable
- emotion_check_question_text text nullable
- assigned_post_question_ids uuid[] nullable (must be exactly length 3 if set)
- assigned_next_exercise_id uuid nullable
- assigned_next_task_ids uuid[] nullable (optional for choose-mode)
- updated_at timestamp

7) sessions_v2 (or extend your existing sessions table with v2 columns)
- id uuid pk
- user_id uuid
- created_at timestamp
- universal_answers jsonb
- task_score float
- mode_preference int (0/1)
- selected_exercise_id uuid nullable
- exercise_liked boolean nullable
- selected_task_id uuid nullable
- task_option_ids uuid[] nullable (if choose-mode)
- intended_emotion text nullable
- keywords text[] nullable (length 3)
- post_question_ids uuid[] (length 3 snapshot)
- post_answers jsonb nullable
- recording_id uuid nullable
- report_id uuid nullable
- status text (state machine)

8) recordings table: add v2 fields (do not remove old)
- session_v2_id uuid nullable
- task_id uuid nullable
- performance_score float nullable
- performance_metrics jsonb nullable (raw+normalized)
- metric_labels_snapshot jsonb nullable
- transcript text (if not already)
- wpm float (if not already)
- filler_count int (if not already)
- audio_url text (if not already)
- created_at timestamp

9) reports (if you don't already have)
- id uuid pk
- session_v2_id uuid
- recording_id uuid
- report_text text
- created_at timestamp

Seed:
- universal_questions: 3 rows
- metric_definitions: 5 rows with default labels:
  pace: slow/fast
  strength: weak/strong
  fillers: 0-3 / more than 3
  emotion_achieved: no / yes
  keywords_used: <2 / >=2
- post_recording_questions: seed at least 3 defaults including code='emotion_achieved_check'

========================
D) BACKEND ENDPOINTS (v2)
========================

Add these endpoints (keep existing endpoints working):

Student:
- GET  /v2/universal-questions
- POST /v2/session/start
  - resume support: if there is an active session_v2 for user, return it with status
- POST /v2/session/:session_id/universal-answers
  - body: answers for Q1/Q2/Q3
  - compute task_score (hardcoded function)
  - select exercise (or exercise=null if none active)
  - select tasks: 1 auto if guide-me, or 3 options if choose
  - select post_recording questions: use per-student assigned set if present else pick 3 active; must include emotion_achieved_check
  - return plan snapshot to frontend: task_score, exercise, tasks, intent prompts, post questions
- POST /v2/session/:session_id/exercise-feedback  (exercise_liked boolean)
- POST /v2/session/:session_id/select-task (task_id) (only if choose-mode)
- POST /v2/session/:session_id/intent (intended_emotion, keywords[3])
- POST /v2/recordings/upload (multipart: audio, session_id, task_id, duration_seconds)
  - store audio, transcribe, compute preliminary metrics (pace/strength/fillers/keywords_used)
  - store performance_metrics with emotion_achieved pending
- POST /v2/session/:session_id/post-answers
  - body: answers for the 3 post questions (including emotion achieved)
  - finalize metrics + performance_score
  - generate report, store, return report to student

Admin (requires admin auth; keep your existing admin auth strategy):
- GET  /v2/admin/students (list users + summary stats)
- GET  /v2/admin/students/:user_id (speaker profile + overrides + sessions + recordings + reports)
- PUT  /v2/admin/students/:user_id/speaker-profile (store structured fields)
- PUT  /v2/admin/students/:user_id/overrides (set prompts, assigned post Qs, next exercise/task)
- POST /v2/admin/students/:user_id/send-assignment
  - create an "assignment" record and email student a link (if you already have Resend, use it; otherwise store assignment and log)

CRUD:
- GET/POST/PUT /v2/admin/exercises
- GET/POST/PUT /v2/admin/tasks
- GET/POST/PUT/DELETE /v2/admin/post-recording-questions
- GET/PUT /v2/admin/metric-definitions (edit labels; enforce exactly 5 fixed codes)

========================
E) TASK SCORE (hardcoded)
========================

Implement task_score as a single function with explicit constants:

Inputs:
- mood: already 0..1
- readiness_norm = readiness / 10
- mode_preference: 0/1

Example formula (adjustable in code):
task_score = clamp(0.45*mood + 0.45*readiness_norm + 0.10*mode_preference, 0, 1)

Keep it easy to tweak.

========================
F) SECURITY
========================

- Verify Supabase JWT Bearer token on every /v2/* call.
- Student can only access own sessions/recordings.
- Admin endpoints require admin status (use your existing method; do not rely on JWT claims unless you already have them).
- If using Supabase service role server-side, still enforce user_id checks.

========================
G) DELIVERABLES
========================

- SQL migrations + seeds
- Flask routes + services implementing the flow
- Unit tests for: exercise skip logic, task selection, question snapshot logic, metric scoring, admin CRUD authorization
- Ensure existing /admin/recordings and /admin/feedback still work.

Implement with minimal disruption and consistent style with the existing codebase.
```

---

## PROMPT 2 — Frontend LLM (full flow + admin)

Paste this when you want the frontend LLM to implement the full v2 student flow and admin expansion (new API routes, types, store, admin pages). This version does not restrict file edits.

```text
You are a senior frontend engineer. Extend an existing Next.js 14 (App Router) TypeScript app using:
- Tailwind CSS
- Zustand session state machine in src/store/session-store.ts
- Supabase auth via @supabase/ssr (client + server clients)
- A BFF proxy pattern: frontend calls Next.js API routes under src/app/api/* which proxy to Flask backend using src/lib/api/bff.ts.
- Existing API client helpers in src/lib/api/client.ts and types in src/lib/api/types.ts.
- Existing flow UI is driven by src/components/dashboard/SessionCard.tsx and uses components like PreRecordingQuestionnaire, PreQuestionsForm, AudioRecorder, PostQuestionsFormV2, CompletedCard.
- Admin pages exist at /admin with AdminAuthGuard, and admin recordings list exists.

Goal: Implement a new "Major Flow v2" student experience and expand the admin panel. Do not break existing routes; add new v2 routes/pages and integrate progressively. Use the existing BFF pattern.

================================
A) STUDENT FLOW (Major Flow v2)
================================

We will add a new v2 session wizard, preferably on /dashboard via SessionCard replacement OR a new route /dashboard/v2. Choose the approach that best fits current flow architecture, but keep the implementation consistent with Zustand and SessionCard patterns.

Student steps: [Step 1 Universal Questions through Step 6 Completed/Report — as in the backend prompt flow. Exercise step SKIP if exercise is null. Exactly 3 post questions. 5 metrics + performance_score; placeholder bars until backend returns.]

Persist/resume:
- Add /api/v2/session/status and a resume mechanism similar to existing session/status.
- Store v2 session id in Zustand and restore on refresh (like existing flow).

================================
B) NEXT.JS API ROUTES (BFF) for v2
================================

[GET/POST routes under src/app/api/v2/** proxying to backend /v2/* — universal-questions, session/start, session/[id]/universal-answers, exercise-feedback, select-task, intent, recordings/upload, post-answers, session/status.]

================================
C) CLIENT API METHODS + TYPES
================================

[Add v2 types to src/lib/api/types.ts and methods in client.ts calling /api/v2/*.]

================================
D) ZUSTAND STORE CHANGES
================================

[Extend or add v2 store/slice with states and fields for v2 flow; resume on dashboard load or only on /dashboard/v2 per your choice.]

================================
E) ADMIN PANEL EXPANSION (v2)
================================

[Routes: /admin/students, /admin/students/[userId], /admin/exercises, /admin/tasks, /admin/metrics, /admin/post-questions. Proxy to /v2/admin/*. Use AdminAuthGuard.]

================================
F) UX/LOGIC RULES
================================

- Exercise step skip if exercise is null.
- Exactly 3 post-recording questions.
- Exactly 5 metrics (labels from backend or snapshot).
- Do not hardcode universal question text; fetch from backend.

================================
G) DELIVERABLES
================================

[New v2 API routes, types, client, v2 session UI, store, admin pages; existing /admin recordings list still works.]
```

**Note:** The full PROMPT 2 (with every A–G section spelled out — universal questions, exercise skip, task step, recording, 5 metrics, post questions, BFF routes, client types, store, admin students/exercises/tasks/metrics/post-questions) should be pasted from your original source when you want the frontend LLM to implement the complete v2 flow and admin expansion. The outline above is a summary; the **PROMPT 2 (tightened)** below is complete and copy-paste-ready for minimal-diff v2 shell only.

---

## PROMPT 2 (tightened) — Frontend with HARD CONSTRAINTS

Use this when you want **minimal diffs only**: create v2 store + v2 route + SessionCardV2, **do not touch v1**. Resume only when user visits `/dashboard/v2`.

```text
You are implementing a v2 session flow in an existing Next.js (App Router) codebase. Follow these constraints exactly and optimize for minimal diffs.

========================
HARD CONSTRAINTS
========================
1) DO NOT TOUCH V1
- Do not modify these files AT ALL:
  - src/store/session-store.ts
  - src/components/dashboard/SessionCard.tsx
- Do not change any existing API routes, middleware, auth logic, or existing API client functions.
- Do not rename or reformat existing files you touch. If you must edit an existing file, make the smallest edit possible.

2) ALLOWED FILE CHANGES (strict allowlist)
You may:
A) CREATE these files:
  - src/store/session-store-v2.ts
  - src/app/(protected)/dashboard/v2/page.tsx
  - src/components/dashboard/SessionCardV2.tsx
B) EDIT only this existing file, and only to add ONE link/button to /dashboard/v2:
  - src/app/(protected)/dashboard/page.tsx
No other file edits.

3) ROLLOUT + RESUME (confirmed)
- v2 lives ONLY at /dashboard/v2. Do not replace /dashboard.
- v2 resume/initialize runs ONLY when /dashboard/v2 is visited (i.e. the v2 component mounts). Do not run v2 initialize anywhere on /dashboard.

========================
IMPLEMENTATION REQUIREMENTS
========================
4) V2 STORE (new file)
- Create src/store/session-store-v2.ts exporting a hook named: useSessionStoreV2
- Read and mirror the patterns in src/store/session-store.ts (v1) without modifying it.
  The goal is: same behavior, same sequencing, same error-handling style, but isolated keys/types.
- State machine: keep the same state names and transitions as v1:
  idle | pre_questionnaire | pre_questions | command_select | recording_ready | recording | recorded | uploading_processing | post_questions | finalizing | completed
  (You may define SessionStateV2 = SessionState (string union) if safe, or duplicate it; do not alter v1 types.)
- Actions: mirror v1 action semantics. You may suffix action names with V2 if needed, but prefer the same action names inside the v2 store to reduce UI changes.
- Draft persistence keys MUST be v2-specific and MUST NOT collide with v1:
  - v1 uses willab:draft:pre_answers:${id} and willab:draft:post_answers:${id}
  - v2 MUST use e.g. willab:v2:draft:pre_answers:${id} and willab:v2:draft:post_answers:${id}
  - If command selection is persisted, v2 key MUST be willab:v2:command_select:${sessionId} (not the v1 key).
- Background upload MUST mirror v1:
  - When user stops recording: call transitionToPostQuestionsWithDefaults(), then uploadRecordingBlob(..., { background: true }).
  - Store an uploadPromise in state.
  - In submitPostAnswers: if recordingId is null, await uploadPromise, then re-read state, then proceed.
  - On successful background upload: migrate post answers by order_index from "default question ids" to "real ids" returned by the upload response (exactly as v1 does).
- Resume/initialize MUST mirror v1:
  - Call fetchSessionStatus()
    - If !has_active_session => set idle (no error).
    - If 401 / token verification fails => set idle (no error).
  - Else startSession({ session_id }) (or whatever v1 does) to fetch plan.
  - Derive state from status flags:
    - !pre_questions_completed => pre_questions (or pre_questionnaire if v1 does that gating)
    - !recording_completed => command_select or recording_ready (depending on saved command selection, matching v1)
    - !post_questions_completed && recording_id => post_questions
    - else => completed
- SSR/localStorage: Any localStorage reads/writes must be guarded (only run in browser), matching v1's approach.

5) V2 ROUTE
- Create src/app/(protected)/dashboard/v2/page.tsx as a SERVER component (no "use client").
- It should render the same dashboard shell/layout used by /dashboard and mount the v2 card.
Example structure (match existing imports):
  DashboardShell
    SessionCardV2

6) SESSIONCARDV2 (client)
- Create src/components/dashboard/SessionCardV2.tsx as a CLIENT component ("use client").
- It must:
  - Use the v2 store (useSessionStoreV2).
  - On mount, run v2 initialize ONLY on this route. Use the same "auth ready" gating pattern as SessionCard.tsx uses (copy the pattern; do not edit SessionCard.tsx).
  - Render a state-driven UI mirroring SessionCard.tsx. Reuse existing UI primitives/components (Card/Button/AudioRecorder/etc.) and reuse the same API client functions/endpoints as v1. Do not create new endpoints.
- Keep this component minimal: do not refactor shared UI; do not move v1 code.

7) OPTIONAL LINK ON /dashboard (single minimal edit)
- Edit src/app/(protected)/dashboard/page.tsx with the smallest possible diff to add ONE link (or button) to /dashboard/v2.
- Do not change existing structure besides inserting the link.
Example minimal insertion:
  import Link from "next/link";
  ...
  <DashboardShell>
    <div className="mb-4">
      <Link href="/dashboard/v2">Try v2</Link>
    </div>
    <SessionCard />
    <DashboardFirstStep />
  </DashboardShell>

========================
OUTPUT / ACCEPTANCE CRITERIA
========================
- Only the allowed files are created/edited.
- v1 flow remains unchanged and still works.
- Visiting /dashboard/v2 runs v2 initialize and drives the v2 session UI.
- v2 localStorage keys never collide with v1 keys.
- Background upload + submitPostAnswers await/migrate behavior matches v1.
- No broad rewrites, no formatting changes, no renames across the codebase.
```

---

## Notes

1. **Recorder:** v1 uploads `command_option_id`; v2 will upload `task_id`. When you add the real v2 upload endpoint, update FormData in the v2 store/upload to send `task_id` (and keep session_id).
2. **Rollout:** The tightened prompt keeps v1 intact and adds a "Try v2" link; for full v2 flow (universal questions, exercise, task, 5 metrics, new backend), use PROMPT 1 (backend) first, then the full PROMPT 2 (frontend) and add the new /api/v2/* routes and types; the tightened prompt is for bootstrapping the v2 shell (store + route + card) without touching v1.
