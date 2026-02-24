# Backend: Return `assigned_exercises` so step 0 shows the assigned exercise

The **homework step 0 screen** (no active session) should show “Assigned for you” with the exercise the admin set for the student. Right now the exercise does not appear because the backend does not return **`assigned_exercises`** in the homework session status response.

---

## 1. Endpoint

**GET /v2/homework/session/status** (or whatever path your BFF proxies to for homework status).

The frontend calls this when the user is on the homework screen with no active session (step 0). It uses the response to show tutor feedback (deadline/message) and **assigned exercises** below the “Start” button.

---

## 2. When to include `assigned_exercises`

- **When** the student has **no active homework session** (e.g. `has_active_session === false` or equivalent: no current session, or status indicates “none” / “no session”).
- **Then** the response **must** include an **`assigned_exercises`** array.

Populate it from the **student’s overrides**:

- If the student has **`assigned_next_exercise_id`** set in overrides (the id the admin chose in the “Assigned next exercise” dropdown), **resolve that id** to the corresponding exercise record and return it (and only it) inside `assigned_exercises`.
- If **`assigned_next_exercise_id`** is missing or null, return **`assigned_exercises: []`** (or omit the field; frontend treats missing as `[]`).

So: **no active session + `assigned_next_exercise_id` set** → return one item in `assigned_exercises`; otherwise return an empty array (or omit).

---

## 3. Shape of `assigned_exercises`

The frontend expects an array of objects with this shape (snake_case):

| Field         | Type   | Required | Description                    |
|---------------|--------|----------|--------------------------------|
| `id`          | string | yes      | Exercise id (e.g. UUID).       |
| `title`       | string | yes      | Exercise title for display.    |
| `video_url`   | string | no       | Optional video URL.            |
| `description` | string | no       | Optional description.         |

Example:

```json
{
  "has_active_session": false,
  "assigned_exercises": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Vocal Projection & Pause",
      "video_url": "https://example.com/video",
      "description": "Focus on clear pauses."
    }
  ]
}
```

If the exercise linked by `assigned_next_exercise_id` was deleted or not found, you can either:

- Omit that exercise (return `assigned_exercises: []`), or  
- Return an array with a minimal object (e.g. `id` + `title: "Unavailable"`) so the UI can show something. Prefer omitting or empty array if you have no valid exercise.

---

## 4. Implementation summary

1. In the handler for **GET homework session/status**:
   - Determine the **current user (student)** from the auth token/session.
   - Determine whether the student has an **active homework session**.
2. If there is **no active session**:
   - Load the student’s **overrides** and read **`assigned_next_exercise_id`**.
   - If present, **fetch the exercise** by that id from your exercises table (or service).
   - Build one object: `{ id, title, video_url?, description? }` (only include `video_url` / `description` if you have them).
   - Set **`assigned_exercises`** to `[that object]` in the JSON response.
   - If `assigned_next_exercise_id` is null or the exercise is not found, set **`assigned_exercises`** to `[]` (or omit).
3. If there **is** an active session:
   - You can omit `assigned_exercises` or set it to `[]`; the step 0 “Assigned for you” block is only shown when there is no active session.

---

## 5. Why the exercise was not showing

The step 0 screen only renders the “Assigned for you” list from **`response.assigned_exercises`**. If the backend never sends **`assigned_exercises`** (or always sends an empty array), the list stays empty and the exercise is not displayed. Adding the logic above to your GET session/status handler will fix it.

---

## 6. Related

- Admin sets the assigned exercise via **PUT** student overrides with **`assigned_next_exercise_id`** (e.g. from the Flow steps “Assigned next exercise” dropdown).
- The same “has an assigned exercise” idea is used in the **assignment email**: see `docs/cursor-prompts/BACKEND_ASSIGNMENT_EMAIL.md` and `docs/backend-reference/assignment_email.py`.
- Frontend types: `HomeworkSessionStatus.assigned_exercises`, `AssignedExercise` in `src/lib/api/types-homework.ts`. Frontend usage: `HomeworkFlowCard` step 0 and `applyStatusToState` when it receives status with `assigned_exercises`.
