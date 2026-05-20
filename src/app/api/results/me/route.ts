import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/results/me
 *
 * Voice-Journey timeline for the authenticated user. Proxies to the
 * Python backend's `GET /v2/user/results/me`, which returns the
 * `VoiceJourneyPayload` shape consumed by /results/page.tsx (see
 * src/lib/results/types.ts).
 *
 * Replaces the page-local MOCK_PAYLOAD: the backend NEVER fabricates
 * snippets. When the user has no published sessions, the response is a
 * status-aware empty payload (status="processing", sessions=[]) so the
 * page renders the founder-video waiting screen instead of fake data.
 *
 * Auth: bearer token. Returns 401 if missing.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error("GET /api/results/me — backend URL is not configured");
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/v2/user/results/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/results/me — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Voice-journey service unavailable." },
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
