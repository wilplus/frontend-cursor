import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students/<user_id>/audit-data
 *
 * BFF proxy for the coach's student audit data (BE #108). Returns
 * performance_under_feeling and stress_as_fuel analytics for the
 * interactive audit view. Coach/admin-gated server-side; 403 soft-fails
 * to null on the FE.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

  const uid = encodeURIComponent(params.userId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/students/${uid}/audit-data`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/coach/students/[userId]/audit-data — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Audit data service unavailable." },
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
        { code: "UPSTREAM_NON_JSON", error: `Unexpected backend response (HTTP ${upstream.status}).` },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }
  return NextResponse.json(data, { status: upstream.status });
}
