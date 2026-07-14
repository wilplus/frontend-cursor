import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/onboarding/opener/start
 *
 * BFF proxy for the onboarding dad-joke opener (#1). Starts the opener: the
 * backend returns 200 { stage:"setup", joke_id, frame, setup } with the joke's
 * framing + setup line, or 204 when there is no opener to run (skip silently).
 * PUBLIC / guest — the opener greets first-contact users before sign-up, so auth
 * is forwarded when present but never required.
 *
 * Verbatim status + JSON pass-through; 204 relays as an empty body so the client
 * can treat "no opener" distinctly from an error.
 */
const UPSTREAM = "/v2/onboarding/opener/start";

export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const token = await getV2AccessToken(req); // optional — guest-allowed
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
      body: "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/onboarding/opener/start — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Opener service unavailable." },
      { status: 502 }
    );
  }

  // 204 = no opener today; relay with an empty body (the client skips silently).
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
