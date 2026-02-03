# PROMPT 2: v2 Session (copy-paste-ready)

Use this prompt with your other LLM. It assumes the rollout and resume choices below.

---

## Confirmed choices

- **Rollout: (a)** — New route `/dashboard/v2` only; v1 stays on `/dashboard`. Optional: add "Start v2 session" link on `/dashboard` → `/dashboard/v2`.
- **Resume:** v2 resume runs **only when the user enters `/dashboard/v2`** (i.e. when the v2 page/component is mounted). Do not run v2 initialize on `/dashboard` load.

*(If you prefer (b) or (c), or "v2 resume on every dashboard load", edit the PROMPT 2 section below accordingly.)*

---

## session-store.ts reference (v1 — do not modify)

Full file path: **`src/store/session-store.ts`**. Key patterns to mirror in v2:

- **Draft keys:** `willab:draft:pre_answers:${id}`, `willab:draft:post_answers:${id}` (id = sessionId or recordingId). Use a **v2-specific prefix** for v2 drafts, e.g. `willab:v2:draft:...`, so v1 and v2 don’t clash.
- **Command selection key:** `willab:command_select:${sessionId}`. For v2 use e.g. `willab:v2:command_select:${sessionId}` if v2 has command selection.
- **Background upload:** When user stops recording, call `transitionToPostQuestionsWithDefaults()` then `uploadRecordingBlob(controller, { background: true })`. Store `uploadPromise`; in `submitPostAnswers`, if `recordingId` is null, `await uploadPromise` then re-read store. On upload success (background), migrate post answers by order_index from default question ids to real ids from response.
- **Resume (initialize):** Call `fetchSessionStatus()`; if `!has_active_session` set state idle. Else fetch plan with `startSession({ session_id })`; then set state from status: `!pre_questions_completed` → pre_questions; `!recording_completed` → command_select or recording_ready (if saved command); `!post_questions_completed && recording_id` → post_questions; else → completed. 401/Token verification → idle, no error.
- **State enum:** idle | pre_questionnaire | pre_questions | command_select | recording_ready | recording | recorded | uploading_processing | post_questions | finalizing | completed.
- **Actions:** initialize, submitQuestionnaire, startNewSession, updatePreAnswer, submitPreAnswers, selectCommandOption, selectDifferentCommand, goBack*, setRecordingReady, setRecordingStart, setRecordingEnd, uploadRecordingBlob, transitionToPostQuestionsWithDefaults, setPostCurrentIndex, updatePostAnswer, submitPostAnswers, finalizeSession, abandonCurrentSession, reset, forceResetLoading.

Full v1 implementation is in **`src/store/session-store.ts`** (851 lines). Do not edit that file.

---

## PROMPT 2 (copy from here)

```
You are implementing a v2 session flow for a Next.js app. Follow these constraints exactly.

**1) Do not touch v1**
- Do not modify `src/store/session-store.ts`.
- Do not modify `src/components/dashboard/SessionCard.tsx` or the existing `/dashboard` page content except to add a single optional link/button to v2 (see below).

**2) Create v2 store**
- Add a new store file: `src/store/session-store-v2.ts` (or a v2 slice in a separate file). It should mirror the v1 session store patterns from `src/store/session-store.ts`:
  - Same state machine shape: idle → pre_questionnaire / pre_questions → command_select → recording_ready → recording → recorded → (background upload) → post_questions → finalizing → completed.
  - Same patterns: uploadPromise for background upload; submitPostAnswers must await uploadPromise when recordingId is null; migrate post answers by order_index when upload returns real question ids.
  - Draft persistence: use a v2-specific prefix so v1 and v2 do not share keys (e.g. `willab:v2:draft:pre_answers:${id}` and `willab:v2:draft:post_answers:${id}`). Same for command selection if v2 has it (e.g. `willab:v2:command_select:${sessionId}`).
  - Resume (initializeV2): call fetchSessionStatus; if no active session set idle; else startSession({ session_id }), then set state from status (pre_questions_completed, recording_completed, post_questions_completed, recording_id). Run this only when the v2 flow is mounted (see route below).
- Export `useSessionStoreV2` (or the v2 slice hook). Types and action names can be suffixed or namespaced (e.g. SessionStateV2, initializeV2) to avoid clashes with v1.

**3) Rollout and resume**
- Rollout: v2 lives only on the new route `/dashboard/v2`. Do not replace SessionCard on `/dashboard`.
- Resume: v2 initialize (resume) must run only when the user is on `/dashboard/v2` (i.e. when the v2 page/component is mounted). Do not run v2 resume on `/dashboard` load.

**4) New route and components**
- Add `src/app/(protected)/dashboard/v2/page.tsx`. It should render the same layout used on dashboard (e.g. DashboardShell) and a new v2 session component (e.g. SessionCardV2) that uses the v2 store. In SessionCardV2, call the v2 initialize (resume) in a useEffect when auth is ready — because this component only mounts on `/dashboard/v2`, resume will run only when the user enters v2.
- Add `src/components/dashboard/SessionCardV2.tsx` (or equivalent). It should mirror the structure of SessionCard (state-driven UI: idle, pre_questionnaire, pre_questions, command_select, recording_ready, recording, recorded, post_questions, finalizing, completed) but use the v2 store. Reuse existing UI primitives (Card, Button, AudioRecorder, etc.) and API client (fetchSessionStatus, startSession, uploadRecording, submitPostAnswers, fetchRecording, abandonSession) — same endpoints; only the store is v2.
- Optional: on `/dashboard`, add a single "Start v2 session" link or button that navigates to `/dashboard/v2`. Minimal change to `src/app/(protected)/dashboard/page.tsx`.

**5) Types**
- Add v2-specific types only where needed (e.g. SessionStateV2, or reuse existing types from `@/lib/api/types`). Do not change existing types in `src/lib/api/types.ts` for v2; extend or duplicate only if necessary.

**6) Minimal diffs**
- No changes to middleware, auth, or API routes.
- No changes to session-store.ts or SessionCard.tsx logic.
- Only add: session-store-v2.ts, dashboard/v2/page.tsx, SessionCardV2.tsx, and optionally one link on the dashboard to /dashboard/v2.
```

---

*(End of PROMPT 2. Paste the block above into your other LLM.)*
