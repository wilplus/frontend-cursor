import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/chat/session-state
 *
 * BFF proxy for the BE-owned chat session state (seam 8).
 * @optional_auth — never 401s; anonymous users receive NO_SESSION.
 * Response: { state: "NO_SESSION" | "PENDING_COACH" | "REVIEW_LOOP" }
 *
 * The FE drives the active Lounge mode off this value:
 *   NO_SESSION    → lounge_idle  (no pending session)
 *   PENDING_COACH → review_pending (sent; awaiting coach)
 *   REVIEW_LOOP   → insights_ready (coach published; unread)
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req); // null for anon — that's ok
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/chat/session-state`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/chat/session-state — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Session-state service unavailable." },
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
        { code: "UPSTREAM_NON_JSON", error: `Unexpected backend response (HTTP ${upstream.status}).` },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}
