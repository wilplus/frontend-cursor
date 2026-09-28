import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import {
  DEFAULT_FAILURES,
  failure,
  relayVerbatim,
  type Failures,
  type Relay,
} from "@/app/api/_lib/envelopes";

// Routes import everything from this one module.
export {
  DEFAULT_FAILURES,
  LEGACY_FAILURES,
  failure,
  relayLegacy,
  relayLenient,
  relayStrict,
  relayVerbatim,
  type FailureEnvelope,
  type Failures,
  type Relay,
} from "@/app/api/_lib/envelopes";

/* -------------------------------------------------------------------------- */
/*  The ONE place the BFF talks to the backend (FE handoff 2026-08-03 §C).      */
/*                                                                            */
/*  Every route goes through callBackend() (JSON proxy) or, for the few        */
/*  streaming/upload routes that need their own abort mapping, backendFetch(). */
/*  No route constructs an Authorization header or a backend URL itself —      */
/*  scripts/check-bff-single-idiom.mjs enforces that in CI.                    */
/*                                                                            */
/*  The ONE sanctioned lane around this file: long media uploads may go        */
/*  browser → Cloudflare Worker → backend (cloudflare/upload-proxy, founder    */
/*  2026-08-04) to escape the permanent Vercel Hobby 300s ceiling. The Worker  */
/*  mirrors this file's trust model (forward, never mint) and envelope.        */
/* -------------------------------------------------------------------------- */

/** Private URL for BFF→backend (e.g. Railway: http://backend.railway.internal:PORT). When set, used instead of public URL. */
const RAW_INTERNAL = process.env.BACKEND_URL_INTERNAL?.trim().replace(/\/+$/, "");
const RAW_PUBLIC =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "";
/** Base URL with no trailing slash. Prefers BACKEND_URL_INTERNAL when set (server-side only). */
const BACKEND_URL = (RAW_INTERNAL || RAW_PUBLIC).replace(/\/+$/, "");

export function getBackendUrl(): string {
  return BACKEND_URL;
}

/** Thrown by backendFetch when no backend URL is configured; callBackend maps
 *  it to the 502 BACKEND_UNAVAILABLE envelope routes have always returned. */
export class BackendNotConfiguredError extends Error {
  constructor() {
    super("Backend URL not configured");
    this.name = "BackendNotConfiguredError";
  }
}

/** Request-bound Supabase client over the WRITABLE cookie store.
 *
 *  getAll (not the legacy get(name)): Supabase chunks a large session across
 *  auth-token.0/.1/... cookies, and only getAll lets it reassemble them.
 *
 *  setAll is the token-refresh fix: getUser() refreshes an expired access
 *  token and then persists the new one by calling setAll. With no writer the
 *  refreshed token lived for exactly one request and every later call started
 *  from the same expired cookie — the "random logout after an idle tab"
 *  reports. Route handlers may write cookies; Server Components may not,
 *  hence the try/catch (middleware refresh covers those renders).
 */
export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a readonly-cookie context (Server Component).
          }
        },
      },
    }
  );
}

function bearerFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

/**
 * The current request's backend access token, or null when signed out.
 *
 * 1. A client-attached `Authorization: Bearer …` header wins (labRecording
 *    and friends send one when signed in) — no auth-server round trip.
 * 2. Cookie session: getUser() VALIDATES against the auth server and triggers
 *    a refresh when the access token is expired (persisted via setAll above);
 *    getSession() alone only reads the cookie without verifying it.
 */
export async function getAccessToken(): Promise<string | null> {
  const headerStore = await headers();
  const fromHeader = bearerFromHeader(headerStore.get("Authorization"));
  if (fromHeader) return fromHeader;

  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** The header that joins a BFF hop to the backend's log lines, Sentry events
 *  and queued jobs (audit A1). Flask binds it for the request and echoes it. */
export const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** A well-formed id the incoming request already carries, or null. */
async function incomingRequestId(): Promise<string | null> {
  try {
    const value = (await headers()).get(REQUEST_ID_HEADER);
    return value && REQUEST_ID.test(value) ? value : null;
  } catch {
    return null; // outside a request scope
  }
}

/** Split a caller's own request id (any casing) off its other headers, so
 *  exactly one X-Request-Id goes upstream. A malformed one is dropped. */
function splitRequestId(
  headerMap: Record<string, string> | undefined
): [Record<string, string>, string | null] {
  const others: Record<string, string> = {};
  let id: string | null = null;
  for (const [key, value] of Object.entries(headerMap ?? {})) {
    if (key.toLowerCase() === REQUEST_ID_HEADER.toLowerCase()) {
      if (REQUEST_ID.test(value)) id = value;
    } else {
      others[key] = value;
    }
  }
  return [others, id];
}

async function resolveRequestId(
  headerMap: Record<string, string> | undefined
): Promise<[Record<string, string>, string]> {
  const [others, own] = splitRequestId(headerMap);
  return [others, own ?? (await incomingRequestId()) ?? newRequestId()];
}

/** Raw authorized fetch to the backend — the single construction point for
 *  base URL + Authorization. For routes that must own their response handling
 *  (streaming uploads with abort ladders, SSE passthrough). Everything else
 *  uses callBackend below. Pass `token` to skip the lookup (or null to force
 *  unauthenticated); pass `signal`/`body` via init as usual. */
export async function backendFetch(
  path: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
    token?: string | null;
    /** Required by undici when streaming a request body (uploads). */
    duplex?: "half";
  } = {}
): Promise<Response> {
  const { token: tokenOverride, headers: extraHeaders, ...rest } = init;
  const base = getBackendUrl();
  if (!base) throw new BackendNotConfiguredError();
  const token =
    tokenOverride !== undefined ? tokenOverride : await getAccessToken();
  const [otherHeaders, requestId] = await resolveRequestId(extraHeaders);
  return fetch(`${base}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...otherHeaders,
      [REQUEST_ID_HEADER]: requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    // `duplex` rides through `rest`; TS's RequestInit hasn't caught up to it.
  } as RequestInit);
}

/**
 * Every JSON-proxy BFF route goes through this. No exceptions, no direct fetch.
 *
 * Auth is required by default; `requireAuth: false` is for the guest-capable
 * routes (Lab upload/readout), where the token is forwarded when present but
 * never demanded. Pass `token` when the route already resolved it (or `null`
 * to send none — the password-gated internal routes). Upstream status + body
 * pass through verbatim (proxyResponse) so the client keeps ownership of the
 * envelope — including the backend's new generic error copy + `ref` join key
 * (handoff §A1).
 *
 * `failures` and `relay` (envelopes.ts) let a route keep the exact envelopes
 * it shipped with — copy is founder-held — while the URL, the token and the
 * fetch live here. Omit both and the behaviour is the pre-Q-A8 one.
 */
export async function callBackend(
  path: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
    requireAuth?: boolean;
    token?: string | null;
    failures?: Failures;
    relay?: Relay;
  } = {}
): Promise<NextResponse> {
  const {
    requireAuth = true,
    token: tokenOverride,
    failures = {},
    relay = relayVerbatim,
    ...rest
  } = init;
  const token =
    tokenOverride !== undefined ? tokenOverride : await getAccessToken();

  if (requireAuth && !token) {
    return failure(failures.unauthenticated ?? DEFAULT_FAILURES.unauthenticated);
  }

  const [otherHeaders, requestId] = await resolveRequestId(rest.headers);
  let upstream: Response;
  try {
    upstream = await backendFetch(path, {
      ...rest,
      headers: { ...otherHeaders, [REQUEST_ID_HEADER]: requestId },
      token,
    });
  } catch (err) {
    if (err instanceof BackendNotConfiguredError) {
      return failure(failures.notConfigured ?? DEFAULT_FAILURES.notConfigured);
    }
    if (failures.timeout && err instanceof Error && err.name === "AbortError") {
      return failure(failures.timeout);
    }
    const unreachable = failures.unreachable ?? DEFAULT_FAILURES.unreachable;
    if (unreachable === "rethrow") throw err;
    console.error(`BFF ${path} — fetch failed:`, err);
    return failure(
      typeof unreachable === "function" ? unreachable(err) : unreachable
    );
  }

  // The id goes back to the browser too, so a bug report can quote it.
  const response = await relay(upstream);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
