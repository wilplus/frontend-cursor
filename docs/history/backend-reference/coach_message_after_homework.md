# Backend: Coach message after homework (no video on homework flow)

The **homework flow** shows a text-only “A message for you” block when the backend returns **`tutor_video_description`** in GET session/status. There is **no video** on the homework page; the frontend does not use `tutor_video_url` anymore.

- **Email**: You can still send an assignment email with an optional video (e.g. `video_url` + `video_description`). The email template can keep the video block if you want.
- **Homework page**: Only the **message** is shown. Store the coach message and return it as **`tutor_video_description`** in GET homework session/status.

---

## 1. What to store

Store the **coach message** (the text the admin enters as “message to student” or “video description”) so you can return it when the student is in an active session or on the homework flow.

- **Field name in your DB**: e.g. `coach_message`, `assignment_message`, or keep `tutor_video_description` / `video_description` for consistency with the API.
- **Where to store**: Wherever you associate “current assignment” with a student, e.g.:
  - A row per “assignment” or “send event” (e.g. `student_assignments` with `student_id`, `message`, `created_at`), and you use the latest when building session/status, or
  - Columns on a “current session” or “current assignment” table (e.g. `v2_sessions.tutor_video_description` or `student_overrides.coach_message`).

You do **not** need to store or return `tutor_video_url` for the homework flow. You may still accept `video_url` in POST send-assignment only for the email (e.g. “Watch video” link in the email).

---

## 2. POST send-assignment

Accept **`video_description`** (coach message) in the body and persist it so GET session/status can return it.

Example (Flask-style):

```python
# POST /v2/admin/students/<student_id>/send-assignment
def send_assignment(student_id: str):
    body = request.get_json(silent=True) or {}
    video_url = (body.get("video_url") or "").strip() or None
    video_description = (body.get("video_description") or "").strip() or None

    # 1) Store the coach message for this student/assignment so GET session/status can return it.
    save_coach_message_for_student(student_id, video_description)

    # 2) Send the email (optional video in email is fine).
    student = get_student(student_id)
    overrides = student.get("overrides") or {}
    html = build_assignment_email_html(
        video_url=video_url,
        coach_message=video_description,
        has_assigned_exercise=bool(overrides.get("assigned_next_exercise_id")),
        homework_link=FRONTEND_URL + "/dashboard",
        student_name=student.get("full_name") or "there",
    )
    resend.Emails.send({"from": "...", "to": student["email"], "subject": "New homework", "html": html})

    return jsonify({"ok": True})
```

**Storing the message** (pick one pattern that fits your schema):

```python
# Option A: Column on a “current assignment” or overrides table
def save_coach_message_for_student(student_id: str, message: str | None) -> None:
    db.execute(
        """
        UPDATE student_overrides
        SET coach_message = %s, updated_at = NOW()
        WHERE student_id = %s
        """,
        (message, student_id),
    )
    # or INSERT ... ON CONFLICT if you use upsert
```

```python
# Option B: Column on the session (when you create a session, copy from assignment)
# When creating a new homework session for the student, set:
#   session.tutor_video_description = latest_assignment_message
```

```python
# Option C: Latest row in an assignments table
def save_coach_message_for_student(student_id: str, message: str | None) -> None:
    db.execute(
        """
        INSERT INTO student_assignments (student_id, coach_message, created_at)
        VALUES (%s, %s, NOW())
        """,
        (student_id, message),
    )
```

---

## 3. GET homework session/status

Include **`tutor_video_description`** in the response when you have a stored message for the current student/assignment. Do **not** include `tutor_video_url` for the homework flow (frontend ignores it).

Example shape:

```json
{
  "has_active_session": true,
  "status": "recording_1_required",
  "session_id": "...",
  "warm_up_task": { "id": "...", "text": "..." },
  "tutor_video_description": "Great job last time. This week focus on pausing after each main point."
}
```

When there is no message, omit the key or set it to `null`:

```json
{
  "has_active_session": true,
  "status": "recording_1_required",
  "session_id": "...",
  "warm_up_task": { "id": "...", "text": "..." }
}
```

Example (pseudo-code) when building the status response:

```python
def get_homework_status_response(student_id: str) -> dict:
    session = get_current_session(student_id)
    assignment_message = get_coach_message_for_student(student_id)

    payload = {
        "has_active_session": session is not None,
        "status": session.status if session else "none",
        "session_id": session.id if session else None,
        "warm_up_task": session.warm_up_task if session else None,
        # ...
    }
    if assignment_message and assignment_message.strip():
        payload["tutor_video_description"] = assignment_message.strip()
    # Do not set tutor_video_url for the homework flow.

    return payload
```

---

## 4. Migration (if you add a new column)

If you add a column to store the message:

```sql
-- Example: add coach message to student overrides
ALTER TABLE student_overrides
ADD COLUMN IF NOT EXISTS coach_message TEXT;

-- Or on an assignments table
ALTER TABLE student_assignments
ADD COLUMN IF NOT EXISTS coach_message TEXT;
```

If you already had `tutor_video_url` and `tutor_video_description` on the session or assignment table:

- Keep **`tutor_video_description`** and keep populating it from the send-assignment message.
- **`tutor_video_url`** is no longer used by the homework flow; you can stop returning it in GET session/status, or keep storing it only for the email if you like.

---

## 5. Summary

| Action | What to do |
|--------|------------|
| **POST send-assignment** | Accept `video_description` (and optionally `video_url` for email). Store the message for the student/assignment. |
| **GET session/status** | Return `tutor_video_description` when you have a stored message. Do not return `tutor_video_url` for the homework flow. |
| **Email** | Keep using `video_url` and `video_description` in the email template as today if you want (video block + body text). |
| **Frontend** | Shows “A message for you” with the text from `tutor_video_description`; no video on the homework page. |
