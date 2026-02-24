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

Populate it from the **student’s overrides**, with a **default for everyone**:

- Prefer **`assigned_exercise_ids`** (array of exercise ids). If present, **resolve each id** to the corresponding exercise and return them in **`assigned_exercises`** in the same order. If the array is empty or missing, fall back below.
- Fallback: if the student has **`assigned_next_exercise_id`** set (legacy single id), resolve that id and return a single-item array in `assigned_exercises`.
- **Default when nothing is set:** If neither `assigned_exercise_ids` nor `assigned_next_exercise_id` is set (e.g. new user, or after login/register), return **exactly one exercise: the default “intro-0”**. Resolve it by a fixed id or slug **`intro-0`** from your exercises table and return `assigned_exercises: [that exercise]`. This way every user sees the intro exercise on step 0 until an admin assigns something else.

So: **no active session** → always return **`assigned_exercises`** (never omit). If the student has assigned ids → those; else if legacy single id → that one; else → **default intro-0**.

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
   - Load the student’s **overrides**. Prefer **`assigned_exercise_ids`** (array); if missing or empty, use **`assigned_next_exercise_id`** as a single-element array.
   - If there are **no** ids (new user, nothing set), **default to the “intro-0” exercise**: resolve by id or slug `intro-0` and use that as the single item.
   - For each id, **fetch the exercise** from your exercises table. Build objects `{ id, title, video_url?, description? }`.
   - Set **`assigned_exercises`** to that array (same order as ids; skip or omit deleted/invalid ids if you prefer). Never omit the field.
3. If there **is** an active session:
   - Omit `assigned_exercises` or set it to `[]`; the step 0 “Assigned for you” block is only shown when there is no active session.

---

## 5. Why the exercise was not showing

The step 0 screen only renders the “Assigned for you” list from **`response.assigned_exercises`**. If the backend never sends **`assigned_exercises`** (or always sends an empty array), the list stays empty and the exercise is not displayed. Adding the logic above to your GET session/status handler will fix it.

---

## 6. What commands visibility (why it sometimes disappears)

The step 0 list is shown when **`assignedExercises.length > 0`** in the frontend. That state is updated only when the frontend **receives** `assigned_exercises` from **GET session/status**:

| When | What happens |
|------|----------------|
| User is on step 0 | An effect runs **GET session/status** once; if the response **includes** `assigned_exercises`, the list is set. If the response **omits** the field, the frontend does **not** overwrite (so the list stays as-is). |
| Every 45s (only if tutor deadline is shown) | Same GET runs; again the list is updated **only if** the response includes `assigned_exercises`. |
| After "Start over" / abandon | State is reset to step 0; the step 0 effect runs again and refetches. The list is repopulated when that GET returns `assigned_exercises`. |

So the list **disappears** when:

1. **Backend omits `assigned_exercises`** on some responses (e.g. only when `has_active_session === false`, or a bug/cache). The frontend used to set the list to `[]` whenever the response didn’t have the field; it now only updates when the field is **present**, so inconsistent backend responses no longer wipe the list.
2. **Backend returns `assigned_exercises: []`** (e.g. no assigned exercises, or wrong student/overrides). Then the list is correctly empty.
3. **Reset to step 0** used to clear the list immediately; the list now stays until the refetch completes, so you don’t see a brief “disappear” then “reappear”.

**Backend rule:** For **GET session/status** when the student has **no active session**, **always** include **`assigned_exercises`** (array, possibly empty). Do not omit the field so the frontend never overwrites a previously loaded list with “no field”.

---

## 7. Related

- Admin sets assigned exercises via **PUT** student overrides with **`assigned_exercise_ids`** (array). The admin UI uses a pool + “Manage list” (like warm-up tasks); multiple exercises can be assigned. Legacy **`assigned_next_exercise_id`** is still supported as a fallback for one exercise.
- The same “has an assigned exercise” idea is used in the **assignment email**: see `docs/cursor-prompts/BACKEND_ASSIGNMENT_EMAIL.md` and `docs/backend-reference/assignment_email.py`.
- Frontend types: `HomeworkSessionStatus.assigned_exercises`, `AssignedExercise` in `src/lib/api/types-homework.ts`. Frontend usage: `HomeworkFlowCard` step 0 and `applyStatusToState` when it receives status with `assigned_exercises`. The frontend only updates the displayed list when the response **includes** the `assigned_exercises` key (it does not set to `[]` when the key is missing).
