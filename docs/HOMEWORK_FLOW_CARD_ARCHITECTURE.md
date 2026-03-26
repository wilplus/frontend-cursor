# HomeworkFlowCard — Architecture Reference

> **Why this document exists:** `HomeworkFlowCard.tsx` is ~2,500 lines and intentionally not split into sub-components.
> The cost of splitting (refactor risk, prop-drilling overhead) outweighs the benefit for the current team size.
> This document is the substitute — read it once before touching the file.

---

## Mental model

The component is a **client-side state machine**. The backend is the source of truth; the frontend mirrors it.

```
Step 0 — Dashboard / assignment ready
  └─ POST /session/start
Step 1 — Recording 1 (warm-up)
  └─ upload recording 1
Step 2 — Self-rating ("How did that feel?")
  └─ POST /session/self-rating
Step 4 — Report
  └─ CTA → back to step 0
```

Step 3 (recording 2) exists in the type system for legacy reasons but is **not rendered** in the current flow.

The single number `step: 0 | 1 | 2 | 3 | 4` drives everything visible on screen.
**Never call `setStep()` directly.** Always go through `applyStatusToState()` so the full state bag stays in sync.

---

## State inventory

### Navigation / session identity

| Variable | Type | Owns |
|---|---|---|
| `step` | `0\|1\|2\|3\|4` | Which screen is visible |
| `sessionId` | `string\|null` | Backend session UUID; `MOCK_SESSION_ID` for demo flows |
| `authReady` | `boolean` | Supabase auth resolved; cold-load effect gate |

### Step 1 — Recording

| Variable | Type | Owns |
|---|---|---|
| `task` | `string` | Warm-up task text shown on step 1 |
| `finalTask` | `string` | Final task text (step 3/legacy) |
| `uploadingRecording` | `1\|2\|null` | Which recording is uploading right now |
| `uploadRecording1InProgressRef` | `useRef<bool>` | Dedup guard for recording 1 upload |
| `uploadRecording2InProgressRef` | `useRef<bool>` | Dedup guard for recording 2 upload |

### Step 2 — Self-rating

| Variable | Type | Owns |
|---|---|---|
| `studentSpeechRatingSubmitted` | `boolean` | Hides rating UI after submit; prevents double-send |
| `savingStudentRating` | `boolean` | Loading state while POST self-rating is in flight |
| `pendingRetrySelfRating` | `{sessionId, rating}\|null` | When recording job isn't done yet, store last payload and retry |
| `lastSelfRatingPayloadRef` | `useRef` | Same payload but via ref (avoids stale closure in retry effect) |
| `hasSetPendingRetryFrom409Ref` | `useRef<bool>` | Dedup: only enqueue one retry per 409 response |

### Step 4 — Report

| Variable | Type | Owns |
|---|---|---|
| `reportText` | `string` | Markdown report content |
| `reportData` | `HomeworkReportResponse\|null` | Full report payload (scores, recordings, etc.) |
| `performanceScoreEnd` | `number\|null` | 0–1 score shown in chart |
| `reportLoading` | `boolean` | Spinner while fetching report |
| `reportError` | `string\|null` | Error message if report fetch failed |
| `reportNotReady` | `boolean` | 409 REPORT_NOT_READY — backend still generating |
| `recordingProcessingFailed` | `boolean` | Terminal: recording 1 analysis failed; no report possible |
| `persistedFinalReportRef` | `useRef` | sessionStorage snapshot so step 4 survives tab refresh |

### Step 0 — Dashboard extras

| Variable | Type | Owns |
|---|---|---|
| `reviewPending` | `boolean` | Coach-review waiting state (replaces assignment card) |
| `mainScreenMessage` | `string\|null` | Message shown in waiting banner |
| `tutorFeedbackDeadlineMs` | `number\|null` | Deadline timestamp (ms); drives countdown timer |
| `tutorFeedbackMessage` | `string\|null` | Optional coach text shown as info banner |
| `step0TutorVideoUrl` | `string\|null` | Coach intro video URL |
| `step0TutorVideoDescription` | `string\|null` | Paired intro text |
| `assignedExercises` | `AssignedExercise[]` | Exercises shown below Start homework |
| `step0Sessions` | `array` | Past reports list (fetched on first "View reports" click) |
| `step0SessionsLoading` | `boolean` | Loading spinner for past reports list |
| `showReportsList` | `boolean` | Toggle: show/hide past reports |
| `visibleReportsCount` | `number` | Pagination: how many past reports are expanded |
| `step0ReportPreviews` | `Record<id,preview>` | Compact preview per session (lazy-fetched) |
| `pollReportsAfterFinish` | `boolean` | Briefly polls sessions list after completion so new report appears |

### Credits

| Variable | Type | Owns |
|---|---|---|
| `credits` | `number\|null` | Balance from backend; shown in header and used as start guard |
| `showInsufficientCreditsModal` | `boolean` | Shown when credits < 5 on start attempt |

### Sniper / coach profile

| Variable | Type | Owns |
|---|---|---|
| `sniperProfile` | `UserSniperProfile\|null` | Adaptive baseline; fetched on load and after session end |
| `sniperSnapshot` | `LiveCoachSnapshot\|null` | Point-in-time snapshot when recording finishes |
| `sniperSnapshotRef` | `useRef` | Same snapshot via ref so it's stable in async callbacks |

### Modals / UI chrome

| Variable | Type | Owns |
|---|---|---|
| `videoModalUrl` | `string\|null` | Non-Vimeo video modal |
| `reportsModalOpen` | `boolean` | Report detail modal |
| `reportModalSessionId` | `string\|null` | Which session the modal shows |
| `countdownTick` | `number` | Increments every second to force countdown re-render |

### Loading / error flags

| Variable | Type | Owns |
|---|---|---|
| `loading` | `boolean` | Initial cold-load spinner |
| `resetting` | `boolean` | `handleStartOver` in progress |
| `syncingBehind` | `boolean` | Background status sync in flight |
| `statusUnknown` | `boolean` | Status fetch returned nothing usable |
| `noWarmupConfigured` | `boolean` | Backend returned no task; show fallback UI |

### Refs (mutation guards, not state)

| Ref | Purpose |
|---|---|
| `autoStartAttemptedRef` | Prevents double cold-load request (React Strict Mode safe) |
| `forcedStep0WaitingRef` | `sessionStorage` flag: force waiting screen after report CTA click |
| `leavingReportRef` | Set while navigating away from step 4; suppresses stale status writes |
| `skipStep2ToReportDoneRef` | Compatibility with old status payloads that skip step 2 |
| `stepRef` | Mirror of `step` for use inside `applyStatusToState` (avoids stale closure) |
| `persistedFinalReportRef` | Read once on mount from sessionStorage |
| `reportDeepLinkHandledRef` | Deep-link report auto-open fires only once per page load |
| `abortRef` | `AbortController` for cancelling in-flight fetch on unmount |
| `metricSubmitInProgress` | Dedup guard for metric submission |

---

## Key functions

### `applyStatusToState(payload)` — **the only way to change step**

Accepts a `HomeworkSessionStatus | HomeworkResponse` and projects it onto all state variables.
It **never downgrades** step (e.g. won't go 4 → 1 on a stale poll).
Any time backend state changes (cold load, poll, mutation response), route through here.

### `syncDashboardStateFromStatus(statusRes)` — step-0 specific projection

Called on step 0 to update review-pending, countdown deadline, exercises, credits, and tutor video
without touching recording/report state. Delegates to `applyStatusToState` for the session fields.

### `activateForcedStep0Waiting()` — post-report CTA handler

Clears all session-scoped state, sets `forcedStep0WaitingRef`, persists it to `sessionStorage`,
sets step to 0 with `reviewPending: true`. This is how the "waiting screen" appears after the student
submits their report without a full logout cycle.

### `clearSessionCommunication()` — reset step-0 banners

Clears tutor deadline, message, review-pending flag, and video URL when a new session starts.

### `handleStartOver()` — abandon session

Calls `DELETE /session` then resets to step 0 via `applyStatusToState({ status: "none" })`.
When coming from step 4, does **not** reset `autoStartAttemptedRef` (avoids re-triggering cold load
before the async review-pending email job has fired).

---

## `useEffect` map

| Lines (approx) | Trigger | What it does |
|---|---|---|
| ~409 | `videoModalUrl` | Esc key closes video modal |
| ~442 | mount | Reads `forcedStep0WaitingRef` from sessionStorage; shows waiting screen immediately |
| ~450 | mount | Scrolls to top |
| ~470 | `authReady` | Fetches sniper profile |
| ~587 | `authReady, step=0` | Refetches status on step 0; keeps waiting screen if `pollReportsAfterFinish` |
| ~1199 | `authReady, step, autoStartAttemptedRef` | **Cold-load:** one-time GET session/status → `applyStatusToState` |
| ~1265 | `step=4, sessionId` | Polls GET report every 3 s when `reportNotReady` |
| ~1295 | `step=4, sessionId` | Fetches report once on step-4 enter |
| ~1351 | `step=4, sessionId` | Fetches report when `reportNotReady` clears |
| ~1379 | `reportNotReady, sessionId` | Retries POST self-rating after recording job finishes (409 recovery) |
| ~1403 | `step=2, sessionId` | Polls GET status on step 2 to detect when recording job is done |
| ~countdown | `tutorFeedbackDeadlineMs` | 1-second interval → increments `countdownTick` |

---

## Adding a new feature — checklist

1. **New backend field?** Add it to `HomeworkSessionStatus` / `HomeworkResponse` in `types-homework.ts`.
2. **New step-0 state?** Project it inside `syncDashboardStateFromStatus`, not ad hoc.
3. **New step transition?** Go through `applyStatusToState`. Never call `setStep()` directly.
4. **New modal?** Add an `open: boolean` + optional `id: string|null` pair. Close on Escape via a `useEffect` like `videoModalUrl`.
5. **New backend poll?** Gate it on `step` + `sessionId !== MOCK_SESSION_ID` + `!leavingReportRef.current`.
6. **New loading flag?** Set it to `false` in `handleStartOver` and inside the catch branch of wherever it's set to `true`.

---

## Constants (module level)

| Name | Value | Purpose |
|---|---|---|
| `MOCK_SESSION_ID` | `"mock-session"` | Sentinel for demo/offline flows — never sent to backend |
| `STEP0_REPORTS_PAGE_SIZE` | `5` | Initial visible report count |
| `FINAL_REPORT_STORAGE_KEY` | `"homeworkReport"` | sessionStorage key for persisted report |
| `FORCE_STEP0_WAITING_STORAGE_KEY` | `"homeworkForceStep0Waiting"` | sessionStorage key for post-report waiting flag |
| `FORCE_STEP0_WAITING_TTL_MS` | `30 min` | Max age for the forced-waiting flag |
| `REVIEW_PENDING_DEFAULT_MESSAGE` | string | Shown when backend hasn't returned a custom message yet |

---

## Things that look wrong but are intentional

- **`stepRef` mirrors `step`** — `applyStatusToState` is a `useCallback` that closes over state. Without `stepRef`, `step` inside the callback would be stale. The ref is the canonical anti-stale-closure pattern.
- **`autoStartAttemptedRef` not in any `useEffect` dependency array** — intentional. We want it to be a mutation guard, not a reactive dependency. Adding it to deps would make the cold-load re-run every time it changes.
- **`forcedStep0WaitingRef` in sessionStorage** — survives `window.location.href` navigation (unlike React state). Required so the waiting screen appears after the CTA on the report navigates away.
- **Credits not decremented on the client** — backend charges on completion, not start. The header and flow both read from `GET session/status`. Do not subtract locally.
