import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/admin/sessions/[sessionId]/next-session-icebreaker/regenerate
 *
 * BFF proxy for Task 10 regenerate. Re-runs the LLM and replaces BOTH
 * ai_draft AND current (intentionally destructive — the admin's single
 * "start over" lever). Rate-limited backend-side (~1/60s/session unless
 * { "force": true }). Verbatim pass-through:
 *
 *   200  new GET shape
 *   429  { retry_after_seconds }   rate-limited
 *   502  LLM_UNAVAILABLE           upstream failure; admin retries
 *
 * @require_admin enforced backend-side.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = await req.text();
  const sessionId = encodeURIComponent(params.sessionId);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/admin/sessions/${sessionId}/next-session-icebreaker/regenerate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: body || "{}",
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "POST /api/v2/admin/sessions/[id]/next-session-icebreaker/regenerate — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Opener service unavailable." },
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
