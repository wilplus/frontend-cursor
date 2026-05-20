import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/** Uses cookies / request — must not be statically analyzed as a static route. */
export const maxDuration = 30;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * GET /api/results/latest
 *
 * Find the user's most recently published session.
 * Returns { session_id, status: "completed"|"no_results" } so the frontend
 * can redirect to /results/[sessionId] or show "no results yet" state.
 *
 * Proxies to: GET /v2/user/results/latest
 */
export async function GET(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = await fetch(`${backend}/v2/user/results/latest`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Results latest API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
