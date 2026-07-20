import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/pieces/[pieceKey]/swap
 *
 * BFF proxy — the discernment decision (accept/reject a pending piece swap).
 * Verbatim relay: the 409s (STALE_SWAP / NOT_PENDING) are first-class
 * outcomes the FE handles with a silent refetch, so status + body pass
 * through untouched.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; pieceKey: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const arcId = encodeURIComponent(params.arcId);
  const pieceKey = encodeURIComponent(params.pieceKey);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arcId}/pieces/${pieceKey}/swap`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "POST /api/v2/explore/arc/[arcId]/pieces/[pieceKey]/swap — fetch failed:",
      err
    );
    return NextResponse.json(
      { error: "Swap service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  if (!text) return new NextResponse(null, { status: upstream.status });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Unexpected backend response (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
