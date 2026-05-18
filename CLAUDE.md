# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps
- `npm run dev` — Next.js dev server
- `npm run build` / `npm run start` — production build / start
- `npm run lint` — `next lint`
- `npm test` — `vitest run` (Vitest is the test runner; tests live next to code as `*.test.ts`, e.g. `src/components/admin/training/queue-archive.test.ts`)
- Run a single test file: `npx vitest run src/components/admin/training/queue-archive.test.ts`
- Run a single test by name: `npx vitest run -t "test name"`
- Task Master CLI: `npm run tm`, `npm run tm:next`, `npm run tm:list` (or `npx task-master ...`). Parse PRD into tasks: `npx task-master parse-prd .taskmaster/docs/prd.txt`.

Environment: copy `.env.local.example` → `.env.local`. The BFF needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and one of `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_URL` / `BACKEND_URL` (first wins; `BACKEND_URL_INTERNAL` overrides server-side, e.g. Railway internal URL). Setting `MOCK_HOMEWORK_BACKEND=1` (or leaving `NEXT_PUBLIC_API_URL` unset) makes the BFF return stub JSON for `/api/homework/*` so the flow runs without the Flask backend.

## Branch workflow (from `.cursor/rules/test-branch-workflow.mdc`)

- **Routine commits go to `develop`** (frontend's staging branch). Backend's "staging" is a deployment URL, not a branch — naming difference is intentional.
- **Never push to `main`** unless the user explicitly asks to go live. `main` is the production frontend branch.
- When pointing the frontend at non-prod APIs, set `NEXT_PUBLIC_API_URL` to the backend staging URL.

## Architecture

Next.js 14 App Router + React 18 + TypeScript. The repo is **frontend + BFF in one Next app**; the actual backend is a separate Flask repo serving `/v2/*`. Three layers you'll touch constantly:

1. **Browser (`src/components`, `src/app/(auth|protected)/...`)** calls **same-origin** `/api/...` paths only. No `v2` ever appears in client URLs. Path alias `@/*` → `src/*`.
2. **BFF (`src/app/api/**/route.ts`)** authenticates via Supabase cookies (`src/app/api/getAuth.ts`, `src/lib/api/bff.ts`) and proxies to the Flask backend with `Authorization: Bearer <supabase_access_token>`. E.g. browser `/api/homework/session/status` → BFF → `BACKEND_URL/v2/homework/session/status`. Server-only modules use `import "server-only"`.
3. **Flask backend (separate repo)** at `/v2/homework/*` and `/v2/admin/*`. Owns state machine, scoring, report generation, credits charging.

Auth and routing live in `middleware.ts`:
- Protected routes (`/dashboard`, `/profile`, `/recordings`, `/change-password`, `/admin`) and admin routes require a Supabase session; otherwise redirect to `/login?redirectTo=...`. `(protected)/layout.tsx` is a server-side safeguard duplicate.
- Middleware **strips `access_token` / `refresh_token` / `token` / `api_key` / `supabase_key`** from query strings so shared links can't leak credentials. Session lives in HttpOnly, SameSite=lax, Secure (prod) cookies only.
- Middleware also sets a strict CSP and rewrites Supabase recovery callbacks that land on `/dashboard` to `/auth/callback`.
- Public funnel routes (`/` and children) bypass auth checks.

Two stores in `src/store/` (`session-store.ts`, `session-store-v2.ts`, `session-store-v2-flow.ts`) — v2 is current. API clients in `src/lib/api/` are split by surface: `homework-client.ts`, `admin-client.ts`, `client-v2.ts`, plus `homework-mock.ts` and `homework-errors.ts`. Supabase clients in `src/lib/supabase/` split into `client.ts` (browser), `server.ts` (server components), `admin.ts` (service-role, server-only).

### Homework flow (the central feature)

The homework flow is a strict 5-step state machine driven entirely by `GET /api/homework/session/status`. This is non-trivial — **read `.taskmaster/docs/APP_DESCRIPTION.md` before changing anything in `src/components/homework/` or `src/app/api/homework/`**. Key invariants you must preserve:

- Step is derived **only** from `session.status` mapped to 5 canonical values: `warm_up`→1, `task_block`→2, `final_task_ready`→3, `post_questions`→4, `completed`→5. There is also an alias table (e.g. `warmup_recorded` → step 2) — extend it there, not with ad-hoc field inference.
- After step-advancing mutations (recording-1, metric-answers, recording-2), set a `uiStepFloor` then refetch status; the displayed step is `max(stepFromStatus, uiStepFloor)` so a stale status read can't drag the UI backward.
- **Step 5 (report) is entered from the `POST post-answers` response body**, not from a GET status — `GET status` does not return completed sessions. After completion, the next status fetch returns `has_active_session: false`, which is correct.
- Recording flow: `recording-upload-url` → upload blob to Supabase Storage (`audio_recordings` bucket) → `POST recording-1` or `recording-2` with **JSON** (`storage_path`, `duration_seconds`), not FormData. Recording 1 (warm-up) min 30 s; recording 2 (final) 60–300 s, validated client-side.
- The real-time strength/pace wheel (`StrengthPaceDartboard` + `useRealtimeStrengthPace`) is **100% client-side** (Web Audio AnalyserNode). There is no `recording-metrics-chunk` endpoint and no ambient-glow / PCM-chunk pipeline — if you see references to those, they are stale. The interval must start only inside `ctx.resume().then(...)`.

### Credits (from `.cursor/rules/architecture-taskmaster.mdc`)

- `GET /api/homework/session/status` is the source of truth for `credits`. It returns `credits` whether or not there's an active session.
- The −5 charge happens on **homework completion with report**, server-side (idempotent: `v2_charge_homework_completion_credits_once`). Not on session start, not on abandon.
- `POST .../session/start` returns **402** when balance < 5. Handle that in the UI; never decrement credits client-side as the source of truth.

## Documentation sources of truth

- **App product / flow / contracts:** `.taskmaster/docs/APP_DESCRIPTION.md` is the only canonical doc. `.taskmaster/docs/README.md` indexes the folder.
- **Credits + status contract details:** `docs/FRONTEND-WHAT-TO-KNOW.md`.
- **UI conventions** (Tailwind tokens, primitives in `src/components/ui/`, spacing, button/CTA patterns, the `cn()` helper from `@/lib/utils`): `docs/STYLING_GUIDELINES.md`. Tailwind only — no CSS-in-JS or SASS. Use semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) defined in `src/app/globals.css`, not raw hex.
- `docs/` also contains targeted notes (admin redesign, panel state matrix, OpenAPI v2 recordings, etc.) but **not** the canonical app description. `docs/archive/` is historical.

## Task Master

Tasks live in `.taskmaster/tasks/tasks.json` (managed by the `task-master-ai` package). Don't hand-edit; use the CLI. PRD source at `.taskmaster/docs/prd.txt`.
