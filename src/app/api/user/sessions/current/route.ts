import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/user/sessions/current
 *
 * Rich session-state surface for post-auth routing decisions. Proxies
 * to the Python backend's `GET /v2/user/sessions/current`, which inspects
 * the user's most recent v2_sessions row and returns:
 *
 *   {
 *     has_session: boolean,
 *     session_id: string | null,
 *     status: "no_session" | "processing" | "pending_review"
 *           | "completed" | "error",
 *     has_recordings: boolean,
 *     turn_count: number,
 *     snippet_count: number,
 *     published_snippet_count: number,
 *     results_published_at: string | null,
 *     recording_processing_status: string | null,
 *     created_at: string | null
 *   }
 *
 * This is the single source of truth for routing freshly-authenticated
 * users — pick between the recorder, the waiting/founder-video screen,
 * and the snippet-timeline page based on `status` alone.
 *
 * Auth: bearer token (Supabase session). Returns 401 if missing.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error("GET /api/user/sessions/current — backend URL is not configured");
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/v2/user/sessions/current`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      // Server-side fetch; never cache so the post-auth routing always
      // reflects the latest DB state.
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/user/sessions/current — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Session-status service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }

  return NextResponse.json(data, { status: upstream.status });
}
