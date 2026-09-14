import "server-only";
import { NextResponse } from "next/server";
import { proxyResponse } from "@/app/api/proxyResponse";

/* -------------------------------------------------------------------------- */
/*  Failure envelopes and body relays for callBackend (audit Q-A8, Phase 4).   */
/*                                                                            */
/*  Every BFF route now reaches the backend through ONE helper, but the copy   */
/*  each route answers a failure with is founder-held (CLAUDE.md: user-facing  */
/*  copy needs sign-off). So the helper takes the route's own envelopes and    */
/*  sends them verbatim; a route that passes nothing gets the shared defaults  */
/*  below. src/app/api/bffEnvelopes.contract.test.ts pins every route's        */
/*  envelope to the strings it shipped with — change the golden file only on   */
/*  a signed-off copy decision.                                                */
/*                                                                            */
/*  Nothing in this file constructs a URL or an Authorization header; that     */
/*  stays in backend.ts, the one file the ratchet allows to.                   */
/* -------------------------------------------------------------------------- */

/** One route-owned failure response: status + the JSON body, sent verbatim. */
export type FailureEnvelope = {
  status: number;
  body: Record<string, unknown>;
};

/** Network failure handling: a fixed envelope, one built from the error (the
 *  legacy proxyJson family echoed `err.message`), or "rethrow" for routes that
 *  keep their own catch-all around the call. */
export type UnreachableFailure =
  | FailureEnvelope
  | ((err: unknown) => FailureEnvelope)
  | "rethrow";

export type Failures = {
  /** `requireAuth` and no token. */
  unauthenticated?: FailureEnvelope;
  /** No backend URL configured (BackendNotConfiguredError). */
  notConfigured?: FailureEnvelope;
  /** `fetch` threw for any reason other than the two above. */
  unreachable?: UnreachableFailure;
  /** `fetch` threw AbortError — the caller's own `signal` fired. Omit it and
   *  an abort is handled as `unreachable`. */
  timeout?: FailureEnvelope;
};

/** The shared envelopes: what callBackend answered before Q-A8 and still does
 *  for every route that passes no `failures`. Unchanged on purpose. */
export const DEFAULT_FAILURES: Required<
  Pick<Failures, "unauthenticated" | "notConfigured" | "unreachable">
> = {
  unauthenticated: {
    status: 401,
    body: { code: "UNAUTHENTICATED", error: "Authentication required." },
  },
  notConfigured: {
    status: 502,
    body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
  },
  // Same generic copy the backend's own error envelope uses (§A1) — no new
  // user-facing text minted here.
  unreachable: {
    status: 502,
    body: { code: "PROXY_ERROR", error: "Something went wrong on our end." },
  },
};

export function failure(envelope: FailureEnvelope): NextResponse {
  return NextResponse.json(envelope.body, { status: envelope.status });
}

/** Turns the upstream Response into the route's NextResponse. Runs outside
 *  callBackend's try/catch: whatever it throws reaches the route, exactly as a
 *  route's own post-fetch code did. */
export type Relay = (upstream: Response) => Promise<NextResponse>;

/** The default: status + body pass through verbatim (proxyResponse), the
 *  client keeps ownership of the envelope. What the 59 routes migrated before
 *  Q-A8 use. */
export const relayVerbatim: Relay = proxyResponse;

/**
 * The "Unexpected backend response" family (≈45 routes): an empty body is
 * relayed bare (`empty: "bare"`) or as `{}` (`empty: "object"`); a body that is
 * not JSON becomes `{ [code,] error: message(status) }` at the upstream status
 * when it is an error, else 502. `bareStatuses` relays the listed statuses with
 * no body regardless (the 204 guard some routes carried).
 */
export function relayStrict(opts: {
  empty: "bare" | "object";
  code?: string;
  message?: (status: number) => string;
  bareStatuses?: readonly number[];
}): Relay {
  const message =
    opts.message ??
    ((status: number) => `Unexpected backend response (HTTP ${status}).`);
  return async (upstream) => {
    if (opts.bareStatuses?.includes(upstream.status)) {
      return new NextResponse(null, { status: upstream.status });
    }
    const text = await upstream.text();
    if (!text) {
      if (opts.empty === "bare") {
        return new NextResponse(null, { status: upstream.status });
      }
      return NextResponse.json({}, { status: upstream.status });
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ...(opts.code ? { code: opts.code } : {}),
          error: message(upstream.status),
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
    return NextResponse.json(data, { status: upstream.status });
  };
}

/**
 * The lenient family (≈30 routes): `upstream.json()` with `{}` for anything
 * that is not JSON (including an empty body), at the upstream status.
 * `bareStatuses` is the 204/205/304 guard the internal journal routes carry;
 * without it a bodiless status throws out of NextResponse.json, as it always
 * did in the routes that had no guard.
 */
export function relayLenient(opts?: {
  bareStatuses?: readonly number[];
}): Relay {
  return async (upstream) => {
    if (opts?.bareStatuses?.includes(upstream.status)) {
      return new NextResponse(null, { status: upstream.status });
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  };
}

/**
 * The envelope the eight former `proxyJson` routes shipped with
 * (src/lib/api/bff.ts, deleted in Q-A8): HTML detection, the 502 diagnostic
 * text, `null` for an empty success body, and a 500 FETCH_ERROR carrying the
 * error message for anything that throws while relaying (proxyJson's catch
 * wrapped its whole body). Kept verbatim for those routes only; nothing new
 * should adopt it.
 */
export function relayLegacy(path: string): Relay {
  return async (upstream) => {
    try {
      const text = await upstream.text();
      if (!text) {
        if (!upstream.ok) {
          return NextResponse.json(
            {
              code: `HTTP_${upstream.status}`,
              error: upstream.statusText || "Request failed",
            },
            { status: upstream.status }
          );
        }
        return NextResponse.json(null, { status: upstream.status });
      }
      if (
        text.includes("<!doctype html>") ||
        text.includes("<html") ||
        text.includes("<title>")
      ) {
        const status = upstream.status === 404 ? 404 : upstream.status || 500;
        return NextResponse.json(
          status === 404
            ? {
                code: "NOT_FOUND",
                error: `Backend route not found: ${path}. The endpoint may not be implemented yet.`,
              }
            : {
                code: "HTML_ERROR_RESPONSE",
                error: `Backend returned HTML (status ${upstream.status}).`,
              },
          { status }
        );
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        console.error(
          "Failed to parse JSON response. Raw text:",
          text.substring(0, 200)
        );
        return NextResponse.json(
          { code: "INVALID_RESPONSE", error: "Backend returned an invalid response." },
          { status: 500 }
        );
      }
      if (upstream.status === 502) {
        console.error("[BFF] Backend returned 502 - Application failed to respond");
        return NextResponse.json(
          {
            code: "BACKEND_UNAVAILABLE",
            error: `Backend server is not responding. Please check:
1. Is your Flask backend running?
2. Is NEXT_PUBLIC_API_URL set correctly? (Current: ${process.env.NEXT_PUBLIC_API_URL || "NOT SET"})
3. Can you reach the backend URL directly?`,
          },
          { status: 502 }
        );
      }
      if (!upstream.ok && json) {
        console.error("Backend error response:", json);
      }
      return NextResponse.json(json, { status: upstream.status });
    } catch (err) {
      console.error("BFF fetch error:", err);
      return NextResponse.json(
        {
          code: "FETCH_ERROR",
          error: err instanceof Error ? err.message : "Failed to reach backend",
        },
        { status: 500 }
      );
    }
  };
}

/** The failures the legacy proxyJson family answered with (see relayLegacy). */
export const LEGACY_FAILURES: Failures = {
  unauthenticated: {
    status: 401,
    body: { code: "UNAUTHORIZED", error: "Session expired" },
  },
  timeout: {
    status: 504,
    body: { code: "TIMEOUT", error: "Backend request timed out after 30 seconds" },
  },
  unreachable: (err: unknown) => ({
    status: 500,
    body: {
      code: "FETCH_ERROR",
      error: err instanceof Error ? err.message : "Failed to reach backend",
    },
  }),
};
