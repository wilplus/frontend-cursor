# Admin notification when a lesson is complete

When a student **fully finishes a lesson** (homework flow completed and report generated), the admin should be notified.

## Required behavior

1. **Email to artur@willonski.com**  
   After each completed lesson that has a generated report for that student, send an email to **artur@willonski.com**.

2. **Email content**  
   The notification should include a link to the **admin panel** so the admin can open the report:
   - Link to the student’s profile, e.g. `/admin/students/{user_id}`  
   - Optionally include a short summary (e.g. date, student email, session id).

## How it is triggered

- **Frontend:** When the student reaches the report step (step 5) and the report is successfully loaded, the app calls:
  - `POST /api/homework/session/{sessionId}/notify-lesson-complete`
  - (Proxied to backend: `POST /v2/homework/session/{sessionId}/notify-lesson-complete`)

- **Backend:** Implement that endpoint so that it:
  1. Verifies the authenticated user owns the session.
  2. Sends one email to **artur@willonski.com** with a link to the admin report for that student/session (e.g. `/admin/students/{user_id}`).  
  The frontend calls this only once per session (idempotent behavior is recommended).

Alternatively, the backend can send the same email when the report is **generated** (e.g. right after `POST post-answers` succeeds), instead of (or in addition to) reacting to the notify endpoint. In that case, the notify endpoint can be a no-op or used as a fallback.
