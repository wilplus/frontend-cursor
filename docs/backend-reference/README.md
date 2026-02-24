# Backend reference: Assignment email

This folder contains **code for the backend** to implement the new assignment email design. Copy into your backend repo and wire to your Resend (or other) email sender.

## Files

- **`assignment_email.py`** – Builds the full HTML and documents how to call it from your send-assignment endpoint.
- **`coach_message_after_homework.md`** – How to store and return the coach message so the homework flow shows “A message for you” (no video on the homework page). Includes POST send-assignment and GET session/status examples.

## Quick integration

1. Copy `assignment_email.py` into your backend (e.g. `services/email/assignment_email.py` or next to your existing email module).
2. In your **POST send-assignment** handler (e.g. `POST /v2/admin/students/<id>/send-assignment`):
   - Read `video_url` and `video_description` from the request body.
   - Get the student (and overrides); set `has_assigned_exercise = bool(overrides.get("assigned_next_exercise_id"))`.
   - Build the homework link (e.g. `FRONTEND_URL + "/dashboard"`).
   - Call `build_assignment_email_html(...)` and send the returned HTML via Resend.

Design and behavior are specified in `docs/cursor-prompts/BACKEND_ASSIGNMENT_EMAIL.md` and match the frontend `CoachEmail` component.
