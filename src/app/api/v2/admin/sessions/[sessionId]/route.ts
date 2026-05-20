import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/admin/sessions/[sessionId]
 *
 * Comprehensive admin payload for one session — proxies the new Flask
 * endpoint `GET /v2/admin/sessions/<id>` which eager-loads:
 *
 *   { id, user_id, status, results_published_at, created_at,
 *     global_metrics: { wpm, fillers, pause_ms, dynamic_db,
 *                       pitch_center, energy, kpi_score, ai_score,
 *                       ai_summary },
 *     turns:    [ { role: "ai" | "user", content, ... }, ... ],
 *     snippets: [ { id, type, audio_url, transcript, ... }, ... ],
 *     total_turns, total_snippets }
 *
 * Distinct from /api/v2/admin/users/[userId]/timeline which returns the
 * older nested-by-question shape that the user-detail page currently
 * consumes. New views should prefer this endpoint — one round-trip,
 * one source of truth, both interview turns and extracted snippets.
 *
 * Auth: admin-required on the backend (@require_admin). The bearer
 * token's role is checked there; this BFF only forwards it.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

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
    upstream = await fetch(`${backendUrl}/v2/admin/sessions/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/admin/sessions/[id] — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Admin session service unavailable." },
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
