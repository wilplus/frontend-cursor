import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";

/**
 * POST /api/v2/reflection/clips/[clipId]/vote
 *
 * BFF proxy for the user's game vote (F2 §1c). Body: { vote: "best" |
 * "not_this" } — validated upstream; a re-vote overwrites (idempotent).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { clipId: string } }
) {
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
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/reflection/clips/${encodeURIComponent(params.clipId)}/vote`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("POST /api/v2/reflection/clips/[clipId]/vote — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Reflection service unavailable." },
      { status: 502 }
    );
  }
  return proxyResponse(upstream);
}
