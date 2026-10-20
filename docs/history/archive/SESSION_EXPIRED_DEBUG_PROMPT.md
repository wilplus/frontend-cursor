# Prompt: Debug "Session expired" on Next.js + Supabase + Flask BFF

Copy the text below to give to another model or developer.

---

## Context

I have a **Next.js 14 App Router** frontend that uses **Supabase Auth** (email/password) and talks to a **Flask backend** via a **BFF (Backend-for-Frontend)** layer: Next.js API Route Handlers that proxy requests to Flask and inject the user's JWT as `Authorization: Bearer <token>`.

**Symptom:** On the dashboard, the user sees "Session expired" everywhere:
- **Start a New Session** → "Error starting session: Session expired"
- **History** → "Session expired" and "Failed to load recordings: Session expired"
- All of these come from the BFF returning **401** with `{ code: "UNAUTHORIZED", error: "Session expired" }` when it cannot get a valid session/token to call the Flask backend.

The user **is logged in** (they see the dashboard, header with email and "Change password" / "Logout"). So the client thinks there is a session, but the **server-side** BFF does not get a valid session or token when handling `/api/session/status`, `/api/session/start`, `/api/user/recordings`, etc.

---

## Stack summary

- **Frontend:** Next.js 14 App Router, TypeScript, Supabase JS client (`@supabase/ssr` + `createBrowserClient` for client, `createServerClient` for server).
- **Auth:** Supabase Auth (email/password). Session is stored in cookies (httpOnly) and/or in memory by the Supabase client.
- **BFF:** Next.js Route Handlers under `/api/*` (e.g. `/api/session/status`, `/api/session/start`, `/api/user/recordings`). They use a shared BFF helper that:
  1. Tries to get a session/token (from request **cookies** or from request **Authorization: Bearer** header).
  2. If none, returns 401 "Session expired".
  3. Otherwise calls Flask with `Authorization: Bearer <access_token>`.
- **Middleware:** Runs on **page** requests only (not on `/api/*`). Uses Supabase `getUser()` to refresh session and set cookies on the response.
- **Flask backend:** Expects `Authorization: Bearer <JWT>` and validates the JWT. No direct involvement in session expiry on the frontend.

---

## What has already been tried

1. **Middleware:** Switched from `getSession()` to `getUser()` so Supabase refreshes the session and sets new cookies on page responses. Middleware does **not** run for `/api/*` requests.
2. **BFF request-scoped session:** BFF now builds a Supabase server client from the **incoming request** (cookies get/set on a response object), calls `getUser()` / `getSession()`, and copies any refreshed cookies onto the final API response. All API routes pass `req` into the BFF.
3. **Client sends Bearer token:** Every client-side API call (session status, start session, user recordings, upload, etc.) now:
   - Calls `getAuthFetchOptions()` which uses the Supabase **browser** client to get `session.access_token`.
   - Sends `Authorization: Bearer <access_token>` and `credentials: "include"` on the fetch to the Next.js API routes.
4. **BFF accepts Authorization header:** The BFF checks `req.headers.get("Authorization")` first; if present and `Bearer <token>`, it uses that token for the Flask request instead of (or before) reading session from cookies.

Despite all of the above, the user still sees "Session expired" on the dashboard. So either:
- The client is not actually sending a valid `Authorization` header (e.g. session is null in the browser when the call runs), or
- The BFF is not receiving or not using the header correctly, or
- There is a different failure path (e.g. token rejected by Flask, or 401 coming from somewhere else).

---

## Relevant files and flow

- **Client API layer (sends token + credentials):**  
  `src/lib/api/client.ts`  
  - `getAuthFetchOptions()`: gets Supabase client, `getSession()`, returns `{ headers: { Authorization: "Bearer " + access_token }, credentials: "include" }`.  
  - All `fetchSessionStatus`, `startSession`, `fetchUserRecordings`, etc. use this and pass `headers` and `credentials` into `fetch("/api/...")`.

- **BFF (server, decides token/session):**  
  `src/lib/api/bff.ts`  
  - `proxyJson(path, init, req)` and `proxyMultipart(..., req)`:  
    - First check `req.headers.get("Authorization")` for `Bearer <token>` and use it if present.  
    - Else call `getSessionForRequest(req)` which uses request cookies and a response object to get/refresh session via Supabase server client.  
  - If no token/session → return 401 `{ code: "UNAUTHORIZED", error: "Session expired" }`.  
  - Otherwise call Flask with `Authorization: Bearer <access_token>`.

- **API routes (pass `req` to BFF):**  
  e.g. `src/app/api/session/status/route.ts`, `src/app/api/session/start/route.ts`, `src/app/api/user/recordings/route.ts` — all call `proxyJson(..., req)` or `proxyMultipart(..., req)` with the incoming `req`.

- **Middleware (pages only, not /api):**  
  `middleware.ts` — skips `/api`; for page requests uses Supabase `getUser()` and sets cookies on the response.

- **Dashboard flow:**  
  - Page: `src/app/(protected)/dashboard/page.tsx` (uses `SessionCard` and `HistorySection`).  
  - `SessionCard` calls `initialize()` then `startNewSession()` from the session store.  
  - Session store (`src/store/session-store.ts`) calls `fetchSessionStatus()` and `startSession()` from `src/lib/api/client.ts`, which use `getAuthFetchOptions()` and then `fetch("/api/session/status")`, `fetch("/api/session/start")`.  
  - `HistorySection` calls `fetchUserRecordings()` which fetches `/api/user/recordings` with the same auth options.

---

## What I need

Please help debug why the server still returns "Session expired" (401) for these API calls even though:

1. The client is supposed to send `Authorization: Bearer <token>` and `credentials: "include"`.
2. The BFF is supposed to accept that header and use the token for the backend call.

Suggest **concrete next steps** (e.g. where to log, what to check in Network tab, or code changes) to find whether:

- The browser actually has a session when the dashboard loads (e.g. `supabase.auth.getSession()` in the client).
- The request to `/api/session/status` (and others) actually includes the `Authorization` header.
- The BFF receives that header and uses it, or falls back to cookies and gets nothing.
- The 401 is returned by the BFF (no token/session) or by Flask (invalid/expired JWT).

If you can suggest an **alternative architecture** (e.g. different way to pass the token, or to refresh the session before API calls), please describe it clearly so we can implement it.

---

## Environment

- Next.js 14.2.x, App Router.
- Supabase: `@supabase/ssr` and `@supabase/supabase-js`.
- Auth: email/password; session in cookies (and client memory).
- BFF: Next.js API routes proxy to Flask; Flask URL from `NEXT_PUBLIC_API_URL`.
