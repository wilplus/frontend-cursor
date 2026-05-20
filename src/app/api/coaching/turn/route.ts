import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/coaching/turn
 *
 * Run one LLM turn against the awareness-stage system prompt. Proxies
 * to `POST /v2/coaching/turn`. The backend parses the LLM's
 * `acknowledgment ||| question [ADVANCE]` output, advances the stage
 * when [ADVANCE] is present, and returns ready-to-render bubbles.
 *
 * Body: { coaching_id: string, user_message: string }
 *
 * 200: { bubbles: [string, string], advance: boolean,
 *        next_stage: "awareness" | "trial" | "complete" }
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
    upstream = await fetch(`${backendUrl}/v2/coaching/turn`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    console.error("POST /api/coaching/turn — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Coach is unavailable. Please try again." },
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
