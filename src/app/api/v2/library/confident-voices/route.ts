import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";

/**
 * GET /api/v2/library/confident-voices
 *
 * BFF proxy for the user's Confident Voices library (F2 §1e): cross-project,
 * coach-verified moments only, newest first. AC-9 standing rule holds through
 * this proxy — no counts, no streaks, no aggregates; a list is a list.
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
    upstream = await fetch(`${backend}/v2/library/confident-voices`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/library/confident-voices — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Library service unavailable." },
      { status: 502 }
    );
  }
  return proxyResponse(upstream);
}
