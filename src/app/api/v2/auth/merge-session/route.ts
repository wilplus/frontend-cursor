import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/auth/merge-session
 *
 * BFF proxy for the willab claim+send (§3.4/§3.5, BE A3). The Lab upload is
 * always a guest session (user_id=null); this endpoint claims it into the
 * caller's account AND sends it to the coach (merge→send, composed). Requires
 * auth — the JWT identifies the claiming user:
 *   - signed-in  → call directly → instant claim+send → review_pending
 *   - unsigned   → OAuth first, then call on the callback
 *
 *   body → { anonymous_session_id }   (the Lab upload's 201 session_id)
 *   200  → { state, ... }             confirmation ONLY on send success (§3.6)
 */
const UPSTREAM = "/v2/auth/merge-session";

export async function POST(req: NextRequest) {
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

  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${UPSTREAM}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/auth/merge-session — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Send service unavailable." },
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
