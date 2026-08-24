import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/** Founder-only post-label audit. This is intentionally a separate route from
 * the blind queue: joining the machine snapshot into that payload would make
 * it possible for the labeling screen to become anchored by accident. */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 },
    );
  }
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 },
    );
  }
  const sid = encodeURIComponent(params.sessionId);
  try {
    const upstream = await fetch(
      `${backend}/v2/coach/sessions/${sid}/confidence-comparison`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error("founder_confidence_comparison.bff_failed", error);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Comparison unavailable." },
      { status: 502 },
    );
  }
}
