# Backend prompt: API paths (frontend no longer uses `v2` in URL)

**Give this to your backend / other LLM** so they know how the frontend talks to the backend.

---

## What changed

The **frontend** no longer uses `v2` in its API paths. All requests now go to:

- **Admin:** `/api/admin/*` (e.g. `/api/admin/tasks`, `/api/admin/students`, `/api/admin/students/:id/warm-up-tasks`)
- **Session (student):** `/api/session/*` (e.g. `/api/session/start`, `/api/session/status`, `/api/session/:id/universal-answers`)
- **Recordings:** `/api/recordings/upload`
- **Universal questions:** `/api/universal-questions`
- **Homework (student):** `/api/homework/start`, `/api/homework/session/:id/recording-1`, etc.

The **Next.js BFF** (API routes under `src/app/api/`) receives these requests and **proxies to your backend** with the same path under `/v2/`:

| Frontend calls        | BFF proxies to backend      |
|-----------------------|-----------------------------|
| `GET /api/admin/tasks` | `GET BASE_URL/v2/admin/tasks` |
| `GET /api/admin/students` | `GET BASE_URL/v2/admin/students` |
| `POST /api/session/start` | `POST BASE_URL/v2/session/start` |
| `POST /api/homework/start` | `POST BASE_URL/v2/homework/start` |
| …                     | …                           |

---

## Backend: no change required

**Your backend can stay exactly as it is.** Keep serving:

- **Admin:** `GET/POST/PUT/DELETE /v2/admin/students`, `/v2/admin/tasks`, `/v2/admin/post-recording-questions`, `/v2/admin/metrics`, `/v2/admin/students/:id/warm-up-tasks`, etc.
- **Student:** `/v2/session/start`, `/v2/session/status`, `/v2/session/:id/universal-answers`, `/v2/recordings/upload`, `/v2/session/:id/post-answers`, etc.
- **Homework (student flow):** `POST /v2/homework/start`, then `/v2/homework/session/:id/recording-1`, `metric-answers`, `recording-2`, `questions`, `post-answers`. If not implemented, frontend shows a friendly error. **Mock:** When `NEXT_PUBLIC_API_URL` is unset or `MOCK_HOMEWORK_BACKEND=1`, the BFF returns stub homework responses so the full student flow works without a backend. If these are not implemented yet, the frontend will show “Homework flow is not available yet” and the browser may log 404 for `/api/homework/start`.

Auth is unchanged: the BFF sends `Authorization: Bearer <supabase_access_token>` to your backend. You still validate the JWT and enforce admin for `/v2/admin/*`.

---

## Summary

- **Frontend:** Calls `/api/admin/*`, `/api/session/*`, `/api/homework/*` (no `v2` in the path).
- **BFF:** Proxies to `BASE_URL/v2/admin/*`, `BASE_URL/v2/session/*`, `BASE_URL/v2/homework/*`.
- **Backend:** Continue to serve `/v2/admin/*`, `/v2/session/*`, `/v2/homework/*`. No backend change needed.

For the full admin API contract (students, tasks, warm-up tasks, metrics, etc.), see **`BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md`**.
