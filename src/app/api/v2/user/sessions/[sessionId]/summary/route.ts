import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/v2/user/sessions/[sessionId]/summary
 *
 * BFF proxy for task 8's user-facing summary endpoint (BE commit
 * `cc4a50e`). The backend handler is the explicit allowlist surface
 * that mirrors admin-side metrics + commentary into the user's view
 * during the publish gate window.
 *
 * Response shape (mirrors BE):
 *   {
 *     status:                "pending_review" | "completed",
 *     metrics_ready:         boolean,
 *     snippets_published:    boolean,
 *     metrics:               {
 *       wpm, fillers, pause_ms, pitch_center_hz, dynamic_db, energy
 *     },
 *     commentary:            { kind: "ai_summary", body } | null,
 *     snippet_count_pending: number
 *   }
 *
 * Allowlist enforcement is load-bearing — the BE handler explicitly
 * jsonifies the user-safe subset and never spreads the v2_sessions
 * row, so a new admin-only column added anywhere is invisible by
 * default. Don't add field projection here; pass through verbatim.
 *
 * Owner-scoping returns 404 (not 403) on a non-owner read so the
 * endpoint can't be used to enumerate session existence.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.sessionId);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/v2/user/sessions/${id}/summary`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "GET /api/v2/user/sessions/[id]/summary — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Summary service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          code: "UPSTREAM_NON_JSON",
          error: `Unexpected backend response (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}
