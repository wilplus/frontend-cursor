# Sniper ratings & baseline — backend directions

The frontend and BFF now support:

- **Student rating (1–10):** "How did that recording feel for you?" on the report step. Stored in `session_sniper_metrics.student_rating_1_10`. Only sessions with rating ≥ 8 update the Sniper baseline.
- **Coach grade (1–10):** "Grade this try" in the admin report modal. Proxied to `PUT /v2/admin/students/:id/sessions/:sessionId/grade`. When grade ≥ 8, the BFF also runs a Sniper baseline update from `session_sniper_metrics` for that session.

## What the backend should do

1. **Persist admin grade**  
   Implement (or keep) `PUT /v2/admin/students/:id/sessions/:sessionId/grade` with body `{ admin_grade: number }` (1–10). Store `admin_grade` on the session or a related table and return it in GET report / GET student profile sessions so the admin UI can show and edit it.

2. **Sessions in Supabase (if using BFF `session_sniper_metrics`)**  
   The BFF upserts into `session_sniper_metrics` with `session_id` when the client sends a Sniper snapshot. That table has a FK to `v2_sessions(id)`. So either:
   - Create/update the corresponding row in `v2_sessions` in Supabase when a session is created (e.g. when the backend creates a session, also insert into Supabase `v2_sessions`), or
   - Relax or remove the FK so the BFF can store metrics for any `session_id` the client sends.

3. **No extra work for student rating**  
   Student rating is stored and applied by the BFF (Supabase `session_sniper_metrics` + `user_sniper_profile`). The backend does not need a dedicated endpoint for it.

## Baseline update rule (BFF)

- **Student:** Baseline is updated only when `student_rating_1_10 >= 8` (and quality gates pass). So the first POST after recording only persists metrics; when the student later submits a rating ≥ 8 via PATCH session-rating, the baseline is updated.
- **Coach:** When the admin saves a grade ≥ 8 via the existing grade endpoint, the BFF loads `session_sniper_metrics` for that session and runs the same baseline update for that user.

## Migration

Run the migration that adds `student_rating_1_10` to `session_sniper_metrics`:

- `docs/migrations/session_sniper_metrics_rating.sql`
