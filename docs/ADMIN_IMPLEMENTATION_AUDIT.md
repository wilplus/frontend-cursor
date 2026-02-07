# Admin panel implementation audit

This doc describes what exists in the **frontend repo** for the admin panel, what the UI calls, what the BFF implements, and why you might still see 404 (e.g. on `/api/admin/tasks`).

---

## 1. How the admin panel is structured

- **Entry:** `/admin` redirects to `/admin/students`. There is **no separate Tasks tab**; tasks are configured per student.
- **Pages that render UI:**
  - **`/admin/students`** — List of students (from `GET /api/admin/students`).
  - **`/admin/students/[id]`** — Single student profile: Homework Configuration (warm-up tasks, focus tasks, post questions, metrics), Speaker Profile, Reports. This page calls **all** of the admin APIs below.
- **Pages that redirect to students:** `/admin/exercises`, `/admin/metrics`, `/admin/questions`, `/admin/recordings` — they immediately redirect to `/admin/students`, so no standalone Exercises/Tasks/Questions/Metrics UI.
- **Other:** `/admin/user/[userId]`, `/admin/recordings` (feedback list), etc. exist but the main flow is Students → [student] → config.

---

## 2. What the frontend calls (admin-client.ts)

The admin UI uses `adminFetch(path)`, which builds the URL as **`/api/admin${path}`** (same origin, no `v2` in path). So for example:

| Frontend method           | HTTP   | URL called by the app        |
|---------------------------|--------|------------------------------|
| getStudents()              | GET    | `/api/admin/students`        |
| getStudentProfile(id)     | GET    | `/api/admin/students/:id`    |
| putOverrides(id, data)    | PUT    | `/api/admin/students/:id/overrides` |
| putSpeakerProfile(id, data)| PUT   | `/api/admin/students/:id/speaker-profile` |
| sendAssignment(id)        | POST   | `/api/admin/students/:id/send-assignment` |
| getWarmUpTasks(id)        | GET    | `/api/admin/students/:id/warm-up-tasks`   |
| createWarmUpTask(id, data)| POST   | `/api/admin/students/:id/warm-up-tasks`    |
| updateWarmUpTask(id, taskId, data) | PUT | `/api/admin/students/:id/warm-up-tasks/:taskId` |
| deleteWarmUpTask(id, taskId) | DELETE | `/api/admin/students/:id/warm-up-tasks/:taskId` |
| getExercises()            | GET    | `/api/admin/exercises`       |
| createExercise(data)      | POST   | `/api/admin/exercises`       |
| updateExercise(id, data)  | PUT    | `/api/admin/exercises/:id`   |
| deleteExercise(id)        | DELETE | `/api/admin/exercises/:id`   |
| **getTasks()**            | **GET**| **`/api/admin/tasks`**       |
| **createTask(data)**      | **POST**| **`/api/admin/tasks`**      |
| **updateTask(id, data)**  | **PUT**| **`/api/admin/tasks/:id`**  |
| **deleteTask(id)**        | **DELETE**| **`/api/admin/tasks/:id`** |
| getPostQuestions()        | GET    | `/api/admin/post-recording-questions` |
| createPostQuestion(data)  | POST   | `/api/admin/post-recording-questions` |
| updatePostQuestion(id, data) | PUT  | `/api/admin/post-recording-questions/:id` |
| deletePostQuestion(id)    | DELETE | `/api/admin/post-recording-questions/:id` |
| getMetricLabels()         | GET    | `/api/admin/metrics`        |
| putMetricLabels(metrics)  | PUT    | `/api/admin/metrics`        |
| getMetricQuestions()      | GET    | `/api/admin/metric-questions` |
| createMetricQuestion(data)| POST   | `/api/admin/metric-questions` |
| updateMetricQuestion(id, data) | PUT | `/api/admin/metric-questions/:id` |
| deleteMetricQuestion(id)  | DELETE | `/api/admin/metric-questions/:id` |

---

## 3. What BFF routes exist in the repo (under `src/app/api/admin/`)

| BFF path (file) | GET | POST | PUT | DELETE | Notes |
|-----------------|-----|------|-----|--------|------|
| `students/route.ts` | ✅ | — | — | — | List students |
| `students/[id]/route.ts` | ✅ | — | — | — | One student profile |
| `students/[id]/overrides/route.ts` | — | — | ✅ | — | |
| `students/[id]/speaker-profile/route.ts` | — | — | ✅ | — | |
| `students/[id]/send-assignment/route.ts` | — | ✅ | — | — | |
| `students/[id]/warm-up-tasks/route.ts` | ✅ | ✅ | — | — | |
| `students/[id]/warm-up-tasks/[taskId]/route.ts` | — | — | ✅ | ✅ | |
| `exercises/route.ts` | ✅ | ✅ | — | — | |
| `exercises/[id]/route.ts` | — | — | ✅ | ✅ | |
| **`tasks/route.ts`** | **✅** | **✅** | — | — | **Focus tasks pool** |
| **`tasks/[id]/route.ts`** | — | — | **✅** | **✅** | |
| `post-recording-questions/route.ts` | ✅ | ✅ | — | — | |
| `post-recording-questions/[id]/route.ts` | — | — | ✅ | ✅ | |
| `metrics/route.ts` | ✅ | PUT ✅ | — | — | |
| `metric-questions/route.ts` | ✅ | ✅ | — | — | |
| `metric-questions/[id]/route.ts` | — | — | ✅ | ✅ | |
| `recordings/route.ts` | ✅ | — | — | — | |
| `feedback/route.ts` | (varies) | — | — | — | |
| `user/[userId]/auth-email/route.ts` | — | — | — | — | (per backend) |
| `user/[userId]/context/route.ts` | — | — | — | — | (per backend) |
| `health/route.ts` | ✅ | — | — | — | No auth; for debugging deploy |

So in the **source code**, the **tasks** BFF is implemented: `src/app/api/admin/tasks/route.ts` (GET, POST) and `src/app/api/admin/tasks/[id]/route.ts` (PUT, DELETE). Every API the student profile page uses has a matching BFF route in the repo.

---

## 4. Why you still get 404 on `/api/admin/tasks` in production

If the **same repo** is deployed to **app.willonski.com** and you still see:

- `Failed to load resource: the server responded with a status of 404 () (tasks, line 0)`
- URL: `https://app.willonski.com/api/admin/tasks`

then the request is **not** being handled by the BFF route in this repo. Possible reasons:

1. **Deployment doesn’t include the tasks route**
   - The deployed app (e.g. on Vercel) was built from a commit or branch that **does not** contain `src/app/api/admin/tasks/route.ts` and `src/app/api/admin/tasks/[id]/route.ts`.
   - **Fix:** Ensure the branch you deploy (e.g. `main`) has these files, push, and trigger a new deploy. Then confirm the deployment log shows a build that includes the `tasks` route.

2. **Build cache**
   - Vercel (or your host) may be reusing an old build that didn’t have the tasks route.
   - **Fix:** Trigger a redeploy with “Clear cache and redeploy” (or equivalent) so the new build includes `api/admin/tasks`.

3. **Different project or repo**
   - The site at `app.willonski.com` might be pointing at another repo or an older project that never had the tasks BFF.
   - **Fix:** In the Vercel (or host) dashboard, confirm the project is this frontend repo and the branch is the one that contains the tasks routes.

4. **Middleware / rewrites**
   - In this repo, `middleware.ts` **skips** all paths starting with `/api`, so middleware is not blocking `/api/admin/tasks`. If you later add rewrites or middleware that treat `/api` differently, they could cause 404.

---

## 5. How to confirm the BFF is deployed

1. **Health check (no auth)**  
   Open in the browser:
   - `https://app.willonski.com/api/admin/health`  
   If you get **200** and a JSON body like `{ "ok": true, "_debug": "admin-health" }`, the admin BFF is deployed and reachable.

2. **Tasks route ping (no auth)**  
   Open:
   - `https://app.willonski.com/api/admin/tasks?ping=1`  
   If you get **200** and body with `_debug: "bff-tasks-route-hit"` and response headers `X-BFF-Route: admin-tasks`, the **tasks** route is deployed and running.

3. **If both return 404**  
   Then the deployment (or the URL) does not include these routes — fix deployment/branch/cache as above.

4. **If health returns 200 but tasks returns 404**  
   Then the build might be partial or the tasks route might be excluded by some config; double-check that `src/app/api/admin/tasks/route.ts` exists in the committed code and that the build runs from that commit.

---

## 6. Summary

| Item | Status in repo |
|------|-----------------|
| Admin UI (Students list + Student profile with Homework Config) | ✅ Implemented |
| Admin API client calling `/api/admin/*` | ✅ Implemented |
| BFF route for students, overrides, speaker-profile, send-assignment | ✅ Implemented |
| BFF route for warm-up-tasks (per student) | ✅ Implemented |
| BFF route for **tasks** (GET/POST + [id] PUT/DELETE) | ✅ Implemented in source |
| BFF route for post-recording-questions, metrics, metric-questions, exercises | ✅ Implemented |
| Diagnostic route `/api/admin/health` and `?ping=1` on tasks | ✅ Implemented |

**Why 404 in production:** The running app at `app.willonski.com` is almost certainly **not** serving the version of the app that contains the tasks BFF. Update the deployed branch, clear build cache, and redeploy so that the build includes `src/app/api/admin/tasks/`.
