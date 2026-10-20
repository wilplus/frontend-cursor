# Frontend prompt: Homework flow – admin overrides and “report generating” state

Use this as the contract and implementation guide for the homework flow on the frontend.

---

## 1. Admin panel: Step 2 & Step 4 overrides

- **GET student profile** returns `overrides` with **snake_case** only:
  - `overrides.skip_metric_questions` (boolean)
  - `overrides.skip_post_questions` (boolean)
- **Read:** Use exactly `response.overrides.skip_metric_questions` and `response.overrides.skip_post_questions`. Do **not** use camelCase (`skipMetricQuestions`) unless you map from the API’s snake_case.
- **Initial state:** When building draft/local state from the profile, set both from the API:
  - `skip_metric_questions: overrides.skip_metric_questions === true`
  - `skip_post_questions: overrides.skip_post_questions === true`
  - Default to `false` if the key is missing.
- **Save (PUT overrides):** Send the same **snake_case** keys in the body:
  - `skip_metric_questions`, `skip_post_questions` (booleans). Include them every time you save overrides so they persist.
- **UI:** Two checkboxes/toggles: “Skip Step 2: Metric questions” and “Skip Step 4: Post-questions”, bound to the above fields. After save and refresh, the toggles must show the saved state.

---

## 2. Student homework flow: “Report generating” after recording 1 (no focus tasks)

When the student has **no focus tasks**, the backend may respond to **POST recording-1** with:

- `status: "report_generating"`
- `recording_1_processing: true`
- Optional `message: "Your report is being generated. Refresh in a moment."`

**Frontend behavior:**

- **Do not** show step 2 (metric questions) or step 3 (second recording) in this case. Show a single “Report” state instead.
- **UI:** Show a clear message, e.g. “Your report is being generated…” (and optionally a short explanation that there’s no second recording this time).
- **Polling:** Call **GET `/v2/homework/session/status`** (or your BFF equivalent) every few seconds (e.g. 2–3 s) until:
  - `status === "completed"`, then show the report (same as after post-answers: use `report_text`, `performance_score_end`, etc. from the status/response).
- **Stopping:** Stop polling after a reasonable limit (e.g. 60–90 s) or when you get `status: "completed"` or an error. On timeout, show a message like “Report is taking longer than usual. Check back later or refresh.”

---

## 3. Contract summary

- **Overrides:** snake_case only in both GET and PUT; read and send `skip_metric_questions` and `skip_post_questions`.
- **New status:** Handle `status: "report_generating"` after recording 1 by showing “report generating” and polling GET session/status until `status: "completed"`, then render the report.

---

## Reference

- **Backend repo:** `docs/FRONTEND-SKIP-OVERRIDES-CONTRACT.md`
- **Frontend overrides UI pattern:** `app/admin/students/[id]/page.tsx` (flow-step checkboxes and save)
