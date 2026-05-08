import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/app/api/getAuth";

/**
 * POST /api/auth/merge-session
 *
 * BFF proxy for the OAuth session-merge flow. Forwards the request to the
 * Python backend's `POST /v2/auth/merge-session`, which atomically links
 * an anonymous cold-start session (created before login) to the now-
 * authenticated user account.
 *
 * Used by `<PendingSessionClaim>` after a LinkedIn / OAuth round-trip:
 * the anonymous `guest_session_id` is stashed in localStorage when the
 * cold-start recording finishes, and replayed here once Supabase has
 * established a session.
 *
 * Request:
 *   Authorization: Bearer <supabase_access_token>   (required)
 *   Body: { anonymous_session_id: string }
 *
 * Response (mirrored from the backend):
 *   200 { status, session_id, analysis_status: "queued" | "already_claimed" }
 *   400 INVALID_INPUT
 *   404 GUEST_SESSION_NOT_FOUND
 *   409 ALREADY_CLAIMED        — bound to a different user
 *   410 GUEST_SESSION_EXPIRED  — older than GUEST_FUNNEL_TTL_HOURS
 *   503 GUEST_FUNNEL_DISABLED
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Use the shared resolver so we honour BACKEND_URL_INTERNAL /
    // BACKEND_URL on Vercel (NEXT_PUBLIC_BACKEND_URL is usually unset in
    // production for security reasons). Falling through to localhost
    // would ECONNREFUSE and surface as a misleading 502.
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      console.error("POST /api/auth/merge-session — backend URL is not configured");
      return NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: "Backend URL is not configured.",
        },
        { status: 502 }
      );
    }

    const upstream = await fetch(`${backendUrl}/v2/auth/merge-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("POST /api/auth/merge-session error:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Merge session service unavailable." },
      { status: 502 }
    );
  }
}
