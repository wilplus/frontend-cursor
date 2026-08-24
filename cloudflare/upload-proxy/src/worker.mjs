/**
 * willab upload proxy — Cloudflare Worker (founder decision 2026-08-04).
 *
 * We never upgrade Vercel past Hobby, so the BFF's upload functions are capped
 * at maxDuration=300 forever. Long media uploads route through THIS Worker
 * straight to the Railway backend instead, restoring the full §B ordering the
 * BFF cannot provide on Hobby:
 *
 *   client abort < backend sync budget (600s) < worker abort (660s default)
 *
 * so the backend's own 504 PROCESSING_TIMEOUT — the one that CARRIES the
 * session_id the client polls — reaches the FE instead of a BFF abort without
 * one.
 *
 * Contract (mirrors the BFF lane so the FE's §A/§B defenses work unmodified):
 *   - STREAMING pass-through: the multipart body pipes to the backend as it
 *     arrives; nothing is buffered here.
 *   - Auth pass-through: `Authorization: Bearer` forwarded when present (both
 *     upload clients attach it); same-origin deployments fall back to the
 *     sb-* auth cookies (chunk-aware, see token.mjs). No token is required —
 *     the lab upload is guest-capable, exactly like the BFF route.
 *   - VERBATIM envelope: upstream status + JSON body pass through untouched
 *     (incl. 504 PROCESSING_TIMEOUT with session_id, 413 FILE_TOO_LARGE,
 *     422, and the generic error+ref envelope). The Worker only speaks for
 *     itself on its own failures, using the same envelope shapes.
 *   - POST only, against an explicit path allowlist — this is an upload
 *     proxy, not an open door to the backend.
 *
 * Config (wrangler.toml [vars] / dashboard):
 *   BACKEND_ORIGIN      required — e.g. https://backend-production-xxxx.up.railway.app
 *   ALLOWED_ORIGINS     comma-separated exact origins for CORS (cross-origin
 *                       deployments only; empty = same-origin/route mode)
 *   ALLOWED_PATHS       optional override of the POST path allowlist
 *   PATH_PREFIX         optional prefix to strip when routed as
 *                       <zone>/<prefix>/v2/… (e.g. "/cf-upload")
 *   UPSTREAM_TIMEOUT_MS optional, default 660000 — must stay ABOVE the
 *                       backend's SYNC_UPLOAD_DEADLINE_SECONDS (600s)
 */
import { accessTokenFromRequestParts } from "./token.mjs";

const DEFAULT_ALLOWED_PATHS = ["/v2/lab/recordings", "/v2/coach/training-imports"];
const DEFAULT_TIMEOUT_MS = 660_000;

// Copy the backend's sanctioned copy verbatim (§A1/§A2) — the Worker mints no
// user-facing text of its own.
const GENERIC_ERROR = "Something went wrong on our end.";
const STILL_PROCESSING =
  "That recording is taking longer than expected — it's still processing, check back shortly.";

function jsonResponse(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(cors ?? {}) },
  });
}

/** CORS headers for this request, {} for same-origin/non-browser callers,
 *  or null when the Origin is present but not allowed.
 *
 *  The FE calls with `credentials: "include"`, and a credentialed CORS
 *  request is only accepted with an EXACT reflected origin plus
 *  Allow-Credentials — never with "*". ("*" stays supported for curl-style
 *  testing; browser calls need a real ALLOWED_ORIGINS entry.) */
function corsFor(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };
  }
  if (allowed.includes("*")) return { "Access-Control-Allow-Origin": "*" };
  return null;
}

function resolvePath(url, env) {
  let path = url.pathname;
  const prefix = (env.PATH_PREFIX || "").replace(/\/+$/, "");
  if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length) || "/";
  return path;
}

function allowedPaths(env) {
  const fromEnv = (env.ALLOWED_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_PATHS;
}

export default {
  async fetch(request, env) {
    const cors = corsFor(request, env);
    if (cors === null) {
      return jsonResponse(403, { code: "ORIGIN_NOT_ALLOWED", error: GENERIC_ERROR });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, content-type, x-requested-with, x-willab-guest-owner",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!env.BACKEND_ORIGIN) {
      return jsonResponse(502, { code: "BACKEND_UNAVAILABLE", error: GENERIC_ERROR }, cors);
    }

    const url = new URL(request.url);
    const path = resolvePath(url, env);
    if (request.method !== "POST" || !allowedPaths(env).includes(path)) {
      return jsonResponse(404, { code: "NOT_FOUND", error: GENERIC_ERROR }, cors);
    }

    // Same trust model as the BFF: extract + forward, never verify or mint.
    const token = accessTokenFromRequestParts(
      request.headers.get("Authorization"),
      request.headers.get("Cookie")
    );

    // Fresh header set — never forward Cookie (the refresh token has no
    // business reaching backend logs), Host, or cf-* metadata upstream.
    const upstreamHeaders = new Headers({ Accept: "application/json" });
    const contentType = request.headers.get("Content-Type");
    if (contentType) upstreamHeaders.set("Content-Type", contentType);
    const requestedWith = request.headers.get("X-Requested-With");
    if (requestedWith) upstreamHeaders.set("X-Requested-With", requestedWith);
    const guestOwner = request.headers.get("X-Willab-Guest-Owner");
    if (guestOwner) upstreamHeaders.set("X-Willab-Guest-Owner", guestOwner);
    if (token) upstreamHeaders.set("Authorization", `Bearer ${token}`);

    // §B abort ladder, worker edition. The timer covers upload + processing
    // and sits ABOVE the backend's 600s budget so the backend's session_id-
    // bearing 504 wins whenever it can answer. Client disconnects propagate —
    // a closed tab shouldn't keep the backend transcribing for a dead request.
    const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    request.signal?.addEventListener("abort", () => controller.abort());

    let upstream;
    try {
      upstream = await fetch(`${env.BACKEND_ORIGIN.replace(/\/+$/, "")}${path}${url.search}`, {
        method: "POST",
        headers: upstreamHeaders,
        body: request.body,
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) {
        // Same envelope as the backend's own §A2 timeout, minus the
        // session_id the backend never got to send. The FE shows the calm
        // still-processing panel (no retry) on this.
        return jsonResponse(
          504,
          { code: "PROCESSING_TIMEOUT", error: STILL_PROCESSING },
          cors
        );
      }
      if (request.signal?.aborted) {
        // Client gone — the response goes nowhere.
        return new Response(null, { status: 499 });
      }
      console.error(`upload-proxy ${path} — upstream fetch failed:`, err);
      return jsonResponse(502, { code: "PROXY_ERROR", error: GENERIC_ERROR }, cors);
    } finally {
      clearTimeout(timer);
    }

    // Verbatim passthrough: status + body stream untouched. The runtime has
    // already decompressed the body, so the encoding/length headers no longer
    // describe it and must go; CORS headers ride on top for browser callers.
    const headers = new Headers(upstream.headers);
    headers.delete("Content-Encoding");
    headers.delete("Content-Length");
    headers.delete("Transfer-Encoding");
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
