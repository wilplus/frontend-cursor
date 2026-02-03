# Frontend v2 integration

V2 flow: **universal questions → exercise (optional) → task → intent → recording → post questions → completed** (report + 5 metrics).

## Order of implementation (done)

1. **Types + client** — `src/lib/api/types-v2.ts`, `src/lib/api/client-v2.ts` (v2Api calls `/api/v2/*`).
2. **BFF API routes** — Next.js routes under `src/app/api/v2/*` proxy to Flask `BACKEND_BASE_URL/v2/*` with auth from `src/lib/api/bff.ts` (no separate getAuth; BFF uses existing proxyJson/proxyMultipart).
3. **Store + SessionCardV2** — `src/store/session-store-v2-flow.ts` (v2 state machine and v2Api), `src/components/dashboard/SessionCardV2.tsx` (uses `useSessionStoreV2Flow`, step-by-step UI).

## Environment

- **Backend URL:** Set `NEXT_PUBLIC_API_URL` to your Flask backend (e.g. `https://your-backend.railway.app` or `http://localhost:5000`). The BFF proxies both v1 and v2 paths; v2 routes use the same env var and prefix paths with `/v2/`.
- No separate `NEXT_PUBLIC_BACKEND_URL`; the codebase uses `NEXT_PUBLIC_API_URL` in `src/lib/api/bff.ts`.

## BFF auth

- All `/api/v2/*` routes use the same auth as v1: `proxyJson` / `proxyMultipart` from `@/lib/api/bff` with `req` so the BFF gets the Supabase access token from `Authorization: Bearer …` or from cookies and forwards it to Flask as `Authorization: Bearer <token>`.

## API route file mapping (BFF → Flask)

| Next.js route (BFF) | Method | Proxies to Flask |
|---------------------|--------|-------------------|
| `src/app/api/v2/universal-questions/route.ts` | GET | `GET /v2/universal-questions` |
| `src/app/api/v2/session/status/route.ts` | GET | `GET /v2/session/status` |
| `src/app/api/v2/session/start/route.ts` | POST | `POST /v2/session/start` |
| `src/app/api/v2/session/[sessionId]/universal-answers/route.ts` | POST | `POST /v2/session/:session_id/universal-answers` |
| `src/app/api/v2/session/[sessionId]/exercise-feedback/route.ts` | POST | `POST /v2/session/:session_id/exercise-feedback` |
| `src/app/api/v2/session/[sessionId]/select-task/route.ts` | POST | `POST /v2/session/:session_id/select-task` |
| `src/app/api/v2/session/[sessionId]/intent/route.ts` | POST | `POST /v2/session/:session_id/intent` |
| `src/app/api/v2/recordings/upload/route.ts` | POST | `POST /v2/recordings/upload` (multipart) |
| `src/app/api/v2/session/[sessionId]/post-answers/route.ts` | POST | `POST /v2/session/:session_id/post-answers` |

## Next steps

- Ensure the Flask backend implements the `/v2/*` endpoints (see backend PROMPT 1 in `V2_MAJOR_FLOW_PROMPTS.md`).
- Admin pages (students list, student profile, CRUD for exercises/tasks/metrics/post-questions) can be added later using the same BFF pattern and `/v2/admin/*` when the backend exposes them.
