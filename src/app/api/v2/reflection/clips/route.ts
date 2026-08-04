import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";

/**
 * GET /api/v2/reflection/clips
 *
 * BFF proxy for the Reflection Game's clip serve (F2 §1b). The BE is the
 * cadence authority (≤2 freshly-served clips per day) and the payload is its
 * explicit allowlist — nothing here may add fields, because the network tab
 * is a user surface and decoy identity must never reach it.
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Sign in required" },
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
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/reflection/clips`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/reflection/clips — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Reflection service unavailable." },
      { status: 502 }
    );
  }
  return proxyResponse(upstream);
}
