# Backend guide: student homework without post-recording questions

The **student dashboard homework flow** no longer uses:

- `GET /v2/homework/session/<id>/questions`
- `POST /v2/homework/session/<id>/post-answers`

The Next.js BFF routes that proxied those calls have been removed. The homework client (`homework-client.ts`) no longer exposes `getQuestions` or `submitPostAnswers`.

---

## What the frontend does today

1. **Start session** → `POST …/start`
2. **Record** → upload → `POST …/recording-1`
3. **Self-rating (1–5)** → `POST …/self-rating` (and optional skip endpoint if you use it)
4. **Report** → `GET …/report` when the session is in a completed / report-ready state

So the “reflective” step for the student is **self-rating only**, not the old multi-question post-recording block.

---

## What you should do on the backend

### 1. Stop requiring `post_questions` for this client path

- After **recording-1** is processed and the student submits **self-rating**, transition the session to a state where **`GET …/report`** succeeds (e.g. `completed`, or whatever your API uses for “report ready”).
- Do **not** depend on the browser calling `POST …/post-answers` to generate the report for this flow.

### 2. Report generation timing

- Generate and persist **`report_text`**, **`performance_score_end`** (and any scores used by `GET report`) when the session is finalized for this flow — e.g. **after self-rating** (or after recording-1 processing if you skip rating in some cases).
- `GET /v2/homework/session/<id>/report` should return the same shape the frontend already expects (see existing `HomeworkReportResponse` / report route).

### 3. Session status for GET status / resume

- If you still emit `post_questions` in the database or internal state machine, either:
  - **Map it away** for this product path (e.g. treat as “waiting for self-rating” or jump straight to report-ready after rating), or
  - **Stop using** `post_questions` for sessions that only go through record → self-rating → report.

The frontend maps `post_questions` to the same step as `completed` / report-in-progress in `mapStatusToStep` (see `src/lib/api/types-homework.ts`), so unexpected `post_questions` without a matching UI should be avoided — prefer explicit statuses that match record → rate → report.

### 4. Optional: keep homework post-answers for other consumers

If other clients (mobile, admin scripts, legacy) still call:

- `GET …/v2/homework/session/<id>/questions`
- `POST …/v2/homework/session/<id>/post-answers`

you can **keep those backend routes**; the **student web app** simply does not call them anymore.

### 5. Admin: post-recording question pool

The **admin UI** may still list “post-recording questions” per student for data or future use. That is separate from the student homework flow. You can:

- Leave admin CRUD as-is, or
- Hide/deprecate it in admin if you no longer want coaches to maintain those rows.

---

## Quick checklist for backend engineers

- [ ] Report is available via **`GET …/report`** after the student finishes **self-rating** (no `post-answers` required for web).
- [ ] **`POST recording-1`** + processing + **`POST self-rating`** (or skip) leads to a terminal state where report generation has run (or is async with a clear “report generating” path the frontend already handles).
- [ ] No student-facing flow **requires** `GET questions` / `POST post-answers` for the dashboard homework card.
- [ ] (Optional) Document or remove unused `post_questions` transitions so ops are not confused.

---

## Related frontend files (reference)

- `src/lib/api/homework-client.ts` — no `getQuestions` / `submitPostAnswers`
- `src/components/homework/HomeworkFlowCard.tsx` — record → self-rating → report
- Removed: `src/app/api/homework/session/[sessionId]/questions/route.ts`, `…/post-answers/route.ts`
