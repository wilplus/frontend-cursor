# What’s in place & edge cases

Quick reference for what the frontend does and where edge cases or backend assumptions matter.

---

## 1. Homework flow (student)

| What’s in place | Notes |
|-----------------|--------|
| **Step 0** (no session) | Start homework button; tutor feedback message + countdown when set; **assigned exercises** from GET status `assigned_exercises` (title, video, description). |
| **Step 1** | Record; sniper wheel (strength/pace); VAD thresholds tuned so ball moves with voice. |
| **Step 5** (report) | Fetch report; show “Loading report…”, then full/simplified report or error states. |

**Edge cases**

- **Report not ready (404 + `REPORT_NOT_READY`)**  
  Backend returns 404 with `code: "REPORT_NOT_READY"` (e.g. status `completing_from_recording_1`). Frontend shows “Your report is being generated” and a **Check again** button that refetches. No generic error.

- **Other report errors**  
  Any other 404 or network error: frontend shows “We couldn’t load your report right now” and “Start new homework”.

- **Session gone**  
  If report fetch returns a “session gone”–style error, frontend toasts and calls `startOverFromScratch()`.

- **Tab refocus**  
  On visibility change, GET status is called and state is applied with **no step downgrade** (step only moves forward or stays same).

---

## 2. Step 0 – Assigned exercises

| What’s in place | Notes |
|-----------------|--------|
| **Source** | `GET /api/homework/session/status` → `assigned_exercises` (array). Backend should populate when `has_active_session === false` from student’s `assigned_next_exercise_id` (or equivalent). |
| **Rendering** | Section “Assigned for you” below Start homework. Each item: **title**, **video** (Vimeo embed or play-overlay → modal iframe), **description** if present. |
| **Cleared when** | User starts a new session (step moves to 1); also cleared when status becomes `"none"`. |

**Edge cases**

- **Empty array**  
  Section is hidden. No “Assigned for you” block.

- **Exercise with no `video_url`**  
  Only title and description are shown (no video block).

- **Non-Vimeo video URL**  
  Play overlay opens modal with iframe `src = video_url`. Some origins may block iframe (e.g. YouTube). Loom/direct links usually work.

- **Status never returns `assigned_exercises`**  
  List stays empty until backend includes it in GET status when there is no active session.

---

## 3. Report step (step 5) – Data shape

| What’s in place | Notes |
|-----------------|--------|
| **Playback** | `final_recording.audio_url` → `recording.audio_url` → `recording_1.audio_url`. |
| **Transcript** | `recording.transcription_text` or legacy `transcript`; full text shown. |
| **Filler** | `recording.filler_words_count.total` or legacy `filler_word_count`; breakdown shown when present (e.g. “um: 3, like: 2”). |
| **Chart** | `performance_history` (unchanged). |
| **Coach block** | `coach_insight`; if missing, block is hidden (backward compat). |

**Edge cases**

- **Missing `recording`**  
  Transcript/filler fall back to legacy fields; if both missing, those sections are hidden. Playback still uses `final_recording` / `recording_1`.

- **Missing `coach_insight`**  
  Coach insight block not rendered (e.g. old sessions or before migration).

- **Simplified report** (`reportFromRecording1Only`)  
  Same sources; when only one recording, simplified layout (one score, first-two-sentences transcript, etc.).

---

## 4. Admin – Send homework email

| What’s in place | Notes |
|-----------------|--------|
| **Form** | Video URL (optional), Message to student (optional). Validation: URL must start with `http://` or `https://`, max 2048 chars; message max 2000 chars. |
| **Request** | `POST /v2/admin/students/<id>/send-assignment` with `{ video_url?, video_description? }`. Only non-empty values sent. |
| **Email design (frontend reference)** | `CoachEmail.tsx`: video block (or orange gradient if no URL), coach message or default text, optional “exercise on main screen” line when student has assigned exercise. See `docs/cursor-prompts/BACKEND_ASSIGNMENT_EMAIL.md`. |

**Edge cases**

- **Both fields empty**  
  Frontend sends `body: undefined` (no body or empty object). Backend should still send an email (e.g. default message + gradient + “View Homework” link).

- **Assigned exercise in email**  
  Backend decides “has assigned exercise” from overrides (`assigned_next_exercise_id`). Frontend does not send it in send-assignment body.

- **Preview**  
  `/admin/email-preview` renders `<CoachEmail />` with no props (gradient, default message, no exercise line). No live student/assignment data.

---

## 5. Admin – Exercises & assignment

| What’s in place | Notes |
|-----------------|--------|
| **Exercise pool** | Section “Exercises” below Warm-up Tasks: list by title, + Add, Edit, Delete. Global pool (same list for all students). |
| **Assign to student** | “Assigned next exercise” dropdown in Flow steps (exercise titles, value = id). Saved via PUT overrides with `assigned_next_exercise_id`. |
| **API** | GET/POST/PUT/DELETE exercises; PUT overrides includes `assigned_next_exercise_id`. |

**Edge cases**

- **Delete exercise that is assigned**  
  Frontend only removes it from local list after delete. Student may still have `assigned_next_exercise_id` pointing to deleted id; backend can return 404 or empty for that exercise in `assigned_exercises`, or filter invalid ids.

- **No exercises**  
  Dropdown shows “— None —” only. Student gets no assigned exercises on step 0.

---

## 6. Sniper wheel (strength/pace ball)

| What’s in place | Notes |
|-----------------|--------|
| **Start** | `realtimeStrengthPace.start(stream)` when recording starts (and on resume). |
| **VAD** | `VOICE_RMS_THRESHOLD = 0.005`, `VOICED_RMS_THRESHOLD = 0.004` so typical mic levels trigger. |
| **Display** | Ball position from strength/pace scores and directions; animation loop runs every frame. |

**Edge cases**

- **AudioContext suspended**  
  Hook calls `resume()` each tick; if context never becomes “running”, strength stays at center (no horizontal movement). Mostly a browser/autoplay policy issue.

- **Very quiet mic**  
  RMS may stay below threshold → voice never “on” → strength axis doesn’t move; pace can still update from silence drift.

---

## 7. Backend expectations (summary)

- **GET session/status**  
  When `has_active_session === false`, return `assigned_exercises` (array of `{ id, title, video_url?, description? }`) so step 0 can show “Assigned for you”.

- **GET report**  
  May return 404 with `code: "REPORT_NOT_READY"`; frontend treats that as “generating” and shows Check again. Other 404 → generic error + Start new homework.

- **POST send-assignment**  
  Receives `video_url`, `video_description`; email template should follow `BACKEND_ASSIGNMENT_EMAIL.md` (gradient when no video, default message when no description, exercise line when student has assigned exercise).

- **Report payload**  
  Optional `recording` (transcription_text, filler_words_count), `coach_insight`; frontend falls back to legacy fields and hides missing blocks.

- **Admin – Reports History**  
  Frontend shows sessions that have `report_preview.report_text_preview`, or `status === "completed"`, or a non-null `recording_id`. Backend returns **full** report text in `report_preview.report_text_preview` (no truncation). Opening a report shows the entire report in a scrollable container (max height, overflow-y auto). List row shows a short preview (line-clamp); modal shows full report.

- **Admin – Coach grade (1–10)**  
  Frontend sends **PATCH** `/v2/admin/students/:userId/sessions/:sessionId` with body `{ coach_grade: number | null }` (1–10 or null for “Not graded”). Backend returns 200 with `{ status: "ok", coach_grade }`. Completed sessions show a grade control (Not graded + 1–10) and “Save grade”; on success the profile is refreshed so the list row shows the new grade. Session type and report response include `coach_grade`.
