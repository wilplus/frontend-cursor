# Backend prompt: Admin API for Next.js frontend

Use this prompt in your **backend repo** (e.g. Flask/Supabase) so the backend correctly serves the existing Next.js admin panel.

---

## Overview

The Next.js app has an admin panel that calls **BFF routes** at **`/api/admin/*`** (no `v2` in path). Those BFF routes proxy to your backend at **`BASE_URL/v2/admin/*`** with the current user’s **Supabase access token** in `Authorization: Bearer <token>`. The frontend never talks to the backend directly; it always goes through the BFF.

**Your backend must:**

1. Accept requests to `https://<your-backend>/v2/admin/*`.
2. Read `Authorization: Bearer <supabase_jwt>` and verify the user (e.g. via Supabase JWT).
3. Enforce **admin-only** access (e.g. check that the user’s email or id is in an `admin_users` table or env list). Return **401** if not authenticated and **403** if not admin.
4. Implement the endpoints and response shapes below so the frontend admin panel works as-is.

**Environment:** The frontend BFF uses `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL` or `BACKEND_URL` as the backend base. Your backend does not need to know about the frontend; it just exposes these routes.

---

## Request flow (for debugging 404 / UNAUTHORIZED)

When you see **404** or **UNAUTHORIZED** in the admin panel or in screenshots, use this flow to see where the request is failing:

1. **Browser** calls the **Next.js BFF** (same origin as the frontend), e.g.  
   `https://your-frontend.vercel.app/api/admin/tasks`
2. The **BFF** reads the user’s session (cookies), gets the Supabase access token, then calls your **Flask backend**, e.g.  
   `https://flask-backend-production-ab37.up.railway.app/v2/admin/tasks`  
   with header: `Authorization: Bearer <token>`.

- **404 NOT_FOUND** (e.g. Vercel-style page): the request never reached your BFF route — check that `src/app/api/admin/tasks/route.ts` exists and is deployed.
- **404** from the **API** (JSON body): the BFF is calling the backend, but the backend has no route for that path — implement `GET /v2/admin/tasks` (and related routes) in Flask.
- **UNAUTHORIZED / "Missing Authorization header"**: that response comes from the **backend**. It means the backend received a request without a valid `Authorization` header. If you’re using the admin UI, the BFF should be sending the token; try signing in again. If you opened the backend URL directly in the browser (e.g. `https://...railway.app/v2/admin/tasks`), that’s expected — only the BFF should call that URL, with the token from the session.

---

## Auth

- Every request from the BFF includes: `Authorization: Bearer <supabase_access_token>`.
- Validate the JWT (e.g. with Supabase) and resolve the user.
- If the user is not in your admin list, return **403 Forbidden** (and optionally **401** when no/invalid token).
- Use the same Supabase project as the frontend so the same JWT is valid.

---

## Endpoints and shapes

Base path: **`/v2/admin`**. All request/response bodies are **JSON** unless noted. The frontend sends `Content-Type: application/json` and expects `application/json` back.

---

### Students

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/admin/students` | List students (admin view). |
| GET | `/v2/admin/students/:id` | Get one student’s profile (for admin student profile page). |
| PUT | `/v2/admin/students/:id/overrides` | Update homework/config overrides for a student. |
| PUT | `/v2/admin/students/:id/speaker-profile` | Update speaker profile for a student. |
| POST | `/v2/admin/students/:id/send-assignment` | Send homework/assignment to student (stub or real). |

**GET /v2/admin/students**

- Query params (optional): `limit`, `offset`.
- Response: `{ "students": [ ... ], "limit": number, "offset": number }`
- Each list item should include at least:
  - `user_id` (string, UUID)
  - `email` or `user_email` (string | null) — **required for the UI to show emails instead of IDs**
  - Optional: `sessions_count` (number), `last_session_at` (ISO string | null), `avg_performance` (number 0–100 | null)

**GET /v2/admin/students/:id**

- Response: single object with:
  - `user_id`, `email`
  - `overrides`: `{ intended_emotion_prompt?, keywords_prompt?, emotion_check_question_text?, assigned_post_question_ids?, assigned_next_exercise_id?, assigned_next_task_ids? }` or null
  - `speaker_profile`: `{ main_goal?, motivation?, strong_points?, weak_points?, charismatic_traits?, hobbies_interests?, personality_type?, coach_notes? }` or null
  - `sessions`: array of `{ id, created_at, status, recording_id?, report_id?, task_score?, recording_preview?: { performance_score_v2?, transcription_preview? }, report_preview?: { report_text_preview? } }`

**PUT /v2/admin/students/:id/overrides**

- Body: `{ intended_emotion_prompt?, keywords_prompt?, emotion_check_question_text?, assigned_post_question_ids?, assigned_next_exercise_id?, assigned_next_task_ids? }`
- Response: `{ "status": "ok" }` or similar (frontend only checks success).

**PUT /v2/admin/students/:id/speaker-profile**

- Body: `{ main_goal?, motivation?, strong_points?, weak_points?, charismatic_traits?, hobbies_interests?, personality_type?, coach_notes? }`
- Response: `{ "status": "ok" }` or similar.

**POST /v2/admin/students/:id/send-assignment**

- Body: none or `{}`.
- Response: `{ "status": "ok" }` or similar.

---

### Exercises

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/admin/exercises` | List all exercises. |
| POST | `/v2/admin/exercises` | Create exercise. |
| PUT | `/v2/admin/exercises/:id` | Update exercise. |
| DELETE | `/v2/admin/exercises/:id` | Deactivate/delete exercise. |

- **GET** response: `{ "exercises": [ { id, title, video_url?, description?, min_task_score?, max_task_score?, is_active?, created_at? } ] }`
- **POST** body: same fields (all optional except as required by your rules). Response: `{ "exercise": { ... } }`
- **PUT** body: partial exercise. Response: `{ "exercise": { ... } }`
- **DELETE** response: `{ "status": "ok" }` or similar.

---

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/admin/tasks` | List all tasks. |
| POST | `/v2/admin/tasks` | Create task. |
| PUT | `/v2/admin/tasks/:id` | Update task. |
| DELETE | `/v2/admin/tasks/:id` | Deactivate/delete task. |

- **GET** response: `{ "tasks": [ { id, title, prompt_text?, min_task_score?, max_task_score?, is_active?, created_at? } ] }`
- **POST** body: `{ title, prompt_text?, min_task_score?, max_task_score?, is_active? }`. Response: `{ "task": { ... } }`
- **PUT** body: partial task. Response: `{ "task": { ... } }`
- **DELETE** response: `{ "status": "ok" }` or similar.

---

### Post-recording questions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/admin/post-recording-questions` | List all post-recording questions. |
| POST | `/v2/admin/post-recording-questions` | Create question. |
| PUT | `/v2/admin/post-recording-questions/:id` | Update question. |
| DELETE | `/v2/admin/post-recording-questions/:id` | Remove/deactivate question. |

- **GET** response: `{ "questions": [ { id, code?, text, answer_type, is_active?, order_index? } ] }`
- **POST** body: `{ text, answer_type?, is_active? }`. Response: `{ "question": { ... } }`
- **PUT** body: partial question. Response: `{ "question": { ... } }`
- **DELETE** response: `{ "status": "ok" }` or similar.

---

### Metrics (label pairs for biofeedback)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v2/admin/metrics` | Get current metric label pairs. |
| PUT | `/v2/admin/metrics` | Save metric label pairs. |

- **GET** response: either `{ "metrics": [ ... ] }` or `{ "metric_labels": [ ... ] }`. Each item: `{ "code": string, "left_label": string, "right_label": string }`.  
  Example codes the frontend uses: `pace`, `strength`, `fillers`, `emotion`, `keywords`. If you return an empty array, the frontend falls back to default labels.
- **PUT** body: `{ "metrics": [ { code, left_label, right_label }, ... ] }`
- Response: `{ "status": "ok" }` or similar.

---

## Database / storage notes

- **Speaker profile:** The frontend expects a table such as `public.v2_speaker_profiles` (or equivalent) keyed by `user_id`, with columns matching `speaker_profile` (e.g. `main_goal`, `motivation`, `strong_points`, `weak_points`, `charismatic_traits`, `hobbies_interests`, `personality_type`, `coach_notes`). If you use PostgREST/Supabase, the table must exist and be exposed; otherwise you may get errors like “Could not find the table 'public.v2_speaker_profiles'”.
- **Students list email:** For the admin Students list to show emails instead of UUIDs, **GET /v2/admin/students** must include `email` (or `user_email`) per student, e.g. by joining with `auth.users` or your users table.
- **Sessions / performance:** For “sessions count”, “avg performance”, “last active” on the list and for session history on the profile, your backend can compute these from sessions/recordings/reports and include them in the students list and in the profile’s `sessions` array.

---

## Error responses

- Use HTTP **401** for missing or invalid token, **403** for valid user but not admin.
- On error, return JSON such as: `{ "error": "Human-readable message", "code": "optional_code" }`. The frontend shows `error` (or a fallback) in toasts.

---

## Summary checklist for backend

- [ ] All routes under `/v2/admin/*` require a valid Supabase JWT and an admin check.
- [ ] **GET /v2/admin/students** returns `students[]` with `user_id` and `email` (or `user_email`), and optionally `sessions_count`, `last_session_at`, `avg_performance`.
- [ ] **GET /v2/admin/students/:id** returns full profile with `overrides`, `speaker_profile`, `sessions` (with optional `recording_preview`, `report_preview`).
- [ ] **PUT** overrides and speaker-profile, **POST** send-assignment implemented.
- [ ] **Exercises:** GET list, POST create, PUT update, DELETE deactivate; response shapes as above.
- [ ] **Tasks:** GET list, POST create, PUT update, DELETE; response shapes as above.
- [ ] **Post-recording questions:** GET list, POST create, PUT update, DELETE; response shapes as above.
- [ ] **Metrics:** GET returns `metrics` or `metric_labels` array; PUT accepts `{ metrics: [ { code, left_label, right_label } ] }`.
- [ ] Speaker profile storage (e.g. `v2_speaker_profiles`) exists and is writable by the backend when the admin updates a student’s speaker profile.

Once these are implemented, the existing Next.js admin panel (Students, Exercises, Tasks, Questions, Metrics, Recordings) will work with your backend without frontend changes.

---

## Troubleshooting: Unauthorized and Not found (frontend)

If you see **Unauthorized** or **Not found** in the admin panel:

### Not found (404)

1. **BFF route exists**  
   In the **frontend** repo, ensure the route file exists:
   - `src/app/api/admin/tasks/route.ts` (GET, POST)
   - `src/app/api/admin/tasks/[id]/route.ts` (PUT, DELETE)
   Restart the dev server; in production, redeploy so the route is included.

2. **Backend route exists**  
   If the BFF returns 404 with a JSON body, the **backend** (Flask) is missing that path. Implement `GET /v2/admin/tasks` (and POST/PUT/DELETE as needed) on the backend.

### Unauthorized (401)

1. **Logged in**  
   Use the admin panel only when signed in. Open `/admin` (or `/admin/tasks`) in the same tab/session where you logged in so cookies are sent.

2. **Same origin**  
   The admin UI calls `/api/admin/tasks` (same origin). It uses `credentials: "include"`, so cookies are sent. If the frontend is on a different domain than the API (e.g. custom domain vs `vercel.app`), ensure cookies are set for the correct domain.

3. **Backend “Missing Authorization header”**  
   That message comes from the **backend**. It means the request that reached Flask had no `Authorization` header. When using the admin UI, the BFF should add it from your session. If you still see it: sign out, sign in again, then reload the admin page. If you opened the backend URL directly in the browser (e.g. `https://...railway.app/v2/admin/tasks`), that’s expected — only the BFF should call that URL, with the token from the session.

4. **Env**  
   In the frontend `.env.local`: set `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL` to your Flask backend base URL (no trailing slash). The BFF uses this to call e.g. `https://your-backend.up.railway.app/v2/admin/tasks`.
