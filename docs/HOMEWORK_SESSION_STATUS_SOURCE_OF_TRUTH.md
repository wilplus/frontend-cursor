# Homework flow: session status is the single source of truth

**This is the canonical rule for the homework flow.**

---

## Rule

**One source of truth:** GET session/status → `session.status` (or `response.session?.status` from the API). The frontend also reads `session.state` or top-level `session_state` as a fallback if the backend uses those keys instead of `status`.

The backend’s **session.status** (`warm_up` | `task_block` | `final_task_ready` | `post_questions` | `completed`) is the **only** source for “which step the user is on.” The frontend must derive the step (1–5) from that and use it for:

- What to show in the UI (warm-up recording, metric questions, final task + recording-2, post-questions, report).
- When to call recording-upload-url, recording-1, recording-2, metric-answers, questions, post-answers.

**Nothing else** (URL, local state, `recording_1_id` / `recording_2_id`, or other heuristics) should override the step when **status is present**. Only when status is missing or unknown should the frontend fall back to other fields or heuristics.

---

## Step mapping

| session.status   | Step | UI / actions |
|------------------|------|--------------|
| `warm_up`        | 1    | Warm-up task + recording-1 (recording-upload-url with recording "1", recording-1) |
| `task_block`     | 2    | Metric answers (metric-answers) |
| `final_task_ready` | 3  | Final task + recording-2 (recording-upload-url with recording "2", recording-2) |
| `post_questions` | 4    | Reflective questions (questions, post-answers) |
| `completed`      | 5    | Report |

---

## Applying this in the frontend

- On load (or when entering homework): call **GET session/status**, read **status** (top-level or `session.status`), derive step, apply via **applyStatusToState(statusRes)**.
- After any step-advancing success (recording-1, metric-answers, recording-2, post-answers): call **GET session/status** again and apply **applyStatusToState**; do not set step from the mutation response alone.
- Do not call recording-upload-url or recording-1 when status is not `warm_up`; do not call recording-2 when status is not `final_task_ready`; and so on for each endpoint’s required status.
