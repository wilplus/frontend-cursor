import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/coaching/start
 *
 * Opens a micro-coaching session on a single snippet. Proxies to
 * `POST /v2/coaching/start` on the Python backend, which validates
 * ownership + presence of admin_comment and creates the
 * coaching_sessions row in the awareness stage.
 *
 * Body: { snippet_id: string }
 *
 * 200: { coaching_id, intent, awareness_message, source_snippet }
 * 401: not signed in
 * 404: snippet missing or not yours
 * 422: snippet has no admin_comment, or charisma intent (v1 stress-only)
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Body must be JSON." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/v2/coaching/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    console.error("POST /api/coaching/start — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Coaching service unavailable." },
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
