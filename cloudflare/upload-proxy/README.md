# willab upload proxy (Cloudflare Worker)

**Why this exists** (founder decision, 2026-08-04): we stay on Vercel Hobby
permanently, so the BFF's upload functions are capped at `maxDuration = 300`
forever — a sync lab upload slower than ~280s gets the §A2 still-processing
envelope *without* a `session_id` to poll. This Worker routes long media
uploads **around** Vercel, straight from the browser to the Railway backend,
restoring the full timeout ordering:

```
client abort  <  backend sync budget (600s)  <  worker abort (660s default)
```

so the backend's own `504 PROCESSING_TIMEOUT` — the one that **carries the
`session_id`** — reaches the FE, and the client's existing §A/§B handling
(ship 2026-08-04, PR #236) polls the readout with zero modification.

## What it does

- **Streaming pass-through**: the multipart body pipes to the backend as it
  arrives; nothing is buffered in the Worker.
- **Auth pass-through**: forwards the client's `Authorization: Bearer` header
  (both upload clients attach it — `labRecording.ts`, `trainingCorpus.ts`);
  in route mode it falls back to extracting the token from the `sb-*` auth
  cookies, chunk-aware (`.0/.1/…` reassembly — `src/token.mjs`, unit-tested).
  Tokens are extracted and forwarded, **never verified or minted** — the
  backend validates every bearer, same trust model as the BFF. Guest uploads
  (no token) pass through unauthenticated, exactly like the BFF lane.
- **Verbatim envelope**: upstream status + JSON body are untouched
  (`PROCESSING_TIMEOUT` + `session_id`, `413 FILE_TOO_LARGE`, `422`, the
  generic `error` + `ref` envelope). The Worker only speaks for itself on its
  own failures, using the same envelope shapes and the same sanctioned copy.
- **POST-only, allowlisted paths** (`/v2/lab/recordings`,
  `/v2/coach/training-imports`) — an upload proxy, not an open backend door.
  The `Cookie` header is never forwarded upstream (the refresh token has no
  business in backend logs).

## Deploy

```sh
cd cloudflare/upload-proxy
npx wrangler login          # once
# edit wrangler.toml: set BACKEND_ORIGIN (+ mode-specific vars, see below)
npx wrangler deploy
```

Then set the FE env (Vercel dashboard) and redeploy the FE:

```
NEXT_PUBLIC_UPLOAD_PROXY_URL=<see modes below>
```

**Unset = fully inert.** The FE keeps using the Vercel BFF lane until this
env var exists, and even when set, the clients fall back to the BFF lane
automatically if the Worker is unreachable — enabling it cannot break upload.

### Mode 1 — route on the zone (preferred)

Requires `willpowerlab.com` DNS on Cloudflare. Same-origin: no CORS, no CSP
changes, cookies reach the Worker.

- `wrangler.toml`: uncomment `routes`, set `PATH_PREFIX = "/cf-upload"`.
- FE env: `NEXT_PUBLIC_UPLOAD_PROXY_URL=https://willpowerlab.com/cf-upload`

### Mode 2 — workers.dev / custom subdomain

Works without moving DNS. Cross-origin:

- `wrangler.toml`: set `ALLOWED_ORIGINS` to the exact site origins.
- FE env: `NEXT_PUBLIC_UPLOAD_PROXY_URL=https://willab-upload-proxy.<acct>.workers.dev`
- CSP: nothing to do — the FE middleware adds this origin to `connect-src`
  automatically from the env var.
- Auth note: cookies do NOT cross origins; this mode relies on the
  `Authorization` header, which both upload clients already send.

## Timeout caveat — verify before relying on >100s syncs

Cloudflare's origin **first-byte timeout** (the ~100s error 524, not
configurable below Enterprise) may apply to Worker subrequests. A sync upload
whose backend takes >100s to send response *headers* could be cut early. If
that happens the Worker returns the §A2 still-processing envelope (no
`session_id`) and the FE degrades exactly as it does on the BFF lane today —
nothing breaks, but the session-id-bearing 504 is lost.

**Verify empirically** with a deliberately slow take after deploying. If the
524 fires, the durable fix is the backend's async lane (202 + poll), which
returns headers immediately and is unaffected by any of these ceilings.

## Contract with the FE (do not break)

1. Pass backend responses through **verbatim** — status and JSON body. The FE
   branches on `code`/status, renders `error` as-is, and appends `ref`.
2. Never return HTML on the error path — every Worker-authored response is
   JSON with `{ code, error }`.
3. Keep `UPSTREAM_TIMEOUT_MS` above the backend's
   `SYNC_UPLOAD_DEADLINE_SECONDS` (600s) — inverting the order swallows the
   backend's `session_id`-bearing 504.
