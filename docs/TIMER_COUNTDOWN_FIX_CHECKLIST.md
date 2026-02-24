# Timer countdown fix checklist

Use this when the “Your tutor has [HH:MM:SS] to send you feedback…” timer does not appear after the user clicks “Send the homework to the coach!” (especially for newly signed-up users).

---

## 1. Frontend: refetch status on step 0 ✅

When the user clicks “Send the homework to the coach!”, the app must:

1. Navigate to step 0 (homework start screen).
2. Call **GET /api/homework/session/status** (or your BFF equivalent) after that navigation.
3. If the response has **`tutor_feedback_deadline`**, render the countdown (and optionally **`tutor_feedback_message`**).

**Implemented in this repo:**

- **Step 0 effect:** When `step === 0` and auth is ready, we always fetch session status and set `tutorFeedbackDeadlineMs` / `tutorFeedbackMessage` from the response. So on step 0 mount/load we refetch and show the timer when the backend sends the deadline.
- **After “Send to coach”:** In `handleStartOver` we call `applyStatusToState({ status: "none" })` (navigate to step 0), then immediately call `homeworkApi.getStatus()` and apply deadline/message from the response.

If the timer still doesn’t show, the response is likely missing `tutor_feedback_deadline` (see backend items below).

---

## 2. Backend: ensure migrations are applied

In **Supabase SQL Editor**, run (if not already run):

- `migrations/add_tutor_feedback_deadline.sql` (adds `completed_at` to `v2_sessions` or equivalent).
- `migrations/add_tutor_feedback_sent_at.sql` (adds `tutor_feedback_sent_at`).

Then: **Supabase → Settings → API → Reload schema cache** (if available).

Without these columns, the backend cannot reliably compute or return the deadline, and the timer will not appear.

*(Migrations live in the backend repo, not in this frontend repo.)*

---

## 3. Backend: stop swallowing errors for the deadline

In **routes/homework.py** (or equivalent), the block that sets `tutor_feedback_deadline` may be inside a broad `try/except` that catches all exceptions and continues, so the response is 200 but without the deadline.

**Fix:**

- In the `except`, at least **log the exception** (and optionally report to Sentry).
- Reproduce the flow and check logs; you’ll see the real error (e.g. missing column, bad type) and can fix it.
- Optionally, only catch specific errors and let others propagate so you get a 500 and a clear stack trace in dev.

---

## 4. Config

Ensure **`TUTOR_FEEDBACK_WINDOW_HOURS`** is set and positive (e.g. `24`) in env / config so the deadline is in the future.

---

## 5. Verify end-to-end

1. Complete a homework as a test user → click “Send the homework to the coach!” → land on step 0.
2. In the browser **Network** tab, confirm a **GET** to your session status endpoint and inspect the JSON:
   - It should contain **`tutor_feedback_deadline`** (and optionally **`tutor_feedback_message`**).

**If they’re missing:** backend issue (migrations, exception in deadline block, or config).

**If they’re present but the timer doesn’t show:** frontend issue (check that the step 0 refetch runs and that the UI renders when those fields exist).

---

See also: **docs/backend-reference/tutor_feedback_deadline_first_lesson.md** for when the backend must return the deadline (including first-time completers).
