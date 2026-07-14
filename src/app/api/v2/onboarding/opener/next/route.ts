import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/onboarding/opener/next
 *
 * BFF proxy for advancing the onboarding dad-joke opener (#1). Body is relayed
 * verbatim: { joke_id, user_reply } returns the punchline; { joke_id,
 * after_punchline:true } returns the pivot into onboarding. PUBLIC / guest —
 * auth is forwarded when present but never required.
 *
 * Verbatim status + JSON pass-through.
 */
const UPSTREAM = "/v2/onboarding/opener/next";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const token = await getV2AccessToken(req); // optional — guest-allowed
  const body = await req.text(); // relay the { joke_id, ... } payload verbatim
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${UPSTREAM}`, {
      method: "POST",
      headers,
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

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

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
