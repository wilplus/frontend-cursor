import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/sessions/[sessionId]/save-feedback
 *
 * BFF proxy — the coach's per-take Save checkpoint (delivery layer): persists
 * the take's coach drafts + stamps coach_feedback_saved_at, WITHOUT delivering
 * anything to the user. Body relayed verbatim (same shape as the publish
 * payload). Coach-gated upstream.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.sessionId);
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/sessions/${id}/save-feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "POST /api/v2/coach/sessions/[sessionId]/save-feedback — fetch failed:",
      err
    );
    return NextResponse.json(
      { error: "Save service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
