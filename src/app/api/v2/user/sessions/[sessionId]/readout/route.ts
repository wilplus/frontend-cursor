import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/sessions/<sessionId>/readout
 *
 * BFF proxy for the willab Readout re-read (§3.0 park/re-read, §6 insights).
 * Same envelope as the upload 201 — { state, session_context, readout:{snippets} }
 * — but POST-PUBLISH it also carries each snippet's `coach{note,tag}` and
 * `readout.insights_payload.overall_message` (the user lane). @require_auth.
 * Reading it is also what triggers the BE's library ingest (§3.11).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.sessionId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/user/sessions/${id}/readout`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/user/sessions/[sessionId]/readout — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Readout service unavailable." },
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
