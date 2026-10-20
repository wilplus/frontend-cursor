# Backend: Tutor countdown timer for first-time completers

The homework flow shows a **countdown timer** on step 0 (start screen):  
“Your tutor has [HH:MM:SS] to send you feedback and a new homework on your email address.”

## When the timer should show

- Student has **no active session** (`has_active_session === false`).
- Student has **at least one completed lesson** (including their **first** submission).
- Tutor has **not yet sent** the next homework (`tutor_feedback_sent_at` unset for this cycle).
- Feedback window (e.g. 24h) is **still in the future**.

## Why it can be missing for new users

For a **newly signed up user** who just completed their first homework and clicked “Send the homework to the coach!”:

1. Frontend calls **POST abandon session** (or equivalent), then **GET homework/session/status**.
2. The timer only appears if **GET session/status** returns **`tutor_feedback_deadline`** (ISO 8601 UTC).
3. If the backend only returns `tutor_feedback_deadline` when there was a **previous** “feedback cycle” (e.g. after the coach has sent homework at least once), then **first-time completers** will never see the timer.

## What the backend should do

- **GET /v2/homework/session/status** (when `has_active_session === false`):  
  If the student has **any** completed lesson (including the one they just finished) and `tutor_feedback_sent_at` is unset and the feedback window is in the future, include **`tutor_feedback_deadline`** in the response (e.g. `last_lesson_completed_at + 24h`). Do **not** require a prior coach feedback event for this.

- Optionally **GET report** (for the completed session) can also return **`tutor_feedback_deadline`** so the frontend can show the countdown as soon as the report is loaded; the same rule applies (first completed lesson still gets a deadline).

## Response shape

```json
{
  "has_active_session": false,
  "status": "none",
  "session_id": null,
  "tutor_feedback_deadline": "2025-02-25T14:00:00.000Z",
  "assigned_exercises": []
}
```

Omit `tutor_feedback_deadline` (or set `null`) when:

- The deadline has passed, or
- The tutor has already sent feedback (`tutor_feedback_sent_at` set), or
- There is no completed lesson for this student.
