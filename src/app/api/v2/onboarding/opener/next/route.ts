import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/onboarding/opener/next
 *
 * BFF proxy for the dad-joke onboarding opener step 2 (Task T2).
 * Works for anonymous AND authenticated users — auth optional,
 * same as /opener/start.
 *
 * Request body:
 *   {
 *     joke_id:         "uuid"     // required for punchline; optional for pivot
 *     user_reply:      string     // optional; used by LLM bridge for ack
 *     after_punchline: boolean    // false → punchline, true → pivot
 *   }
 *
 * Responses:
 *   200 punchline  { stage: "punchline", joke_id, ack, punchline }
 *   200 pivot      { stage: "pivot", joke_id: null, pivot_line, done: true }
 *   400 INVALID_INPUT — missing/invalid joke_id on punchline call
 *   404 JOKE_NOT_FOUND — admin deactivated joke mid-flow; FE bails to onboarding
 *   500 V2_ERROR — unexpected; FE bails to onboarding
 *
 * Pass-through verbatim — the FE hook handles all error paths.
 */
export async function POST(req: NextRequest) {
  const token = await getV2AccessToken(req);

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
    upstream = await fetch(`${backend}/v2/onboarding/opener/next`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/onboarding/opener/next — fetch failed:", err);
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
