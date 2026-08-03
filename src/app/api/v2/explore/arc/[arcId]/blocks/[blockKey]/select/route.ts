import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/blocks/[blockKey]/select
 *
 * BFF proxy — pick one variant from the block's pool (mix & match). Status
 * passthrough so the FE can treat 404 (pool changed / flag off) and 409
 * (NOT_PENDING) as a silent picker refetch rather than an error. The write
 * is non-destructive by design: the displaced text goes back to the pool.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; blockKey: string } }
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
  const arc = encodeURIComponent(params.arcId);
  const key = encodeURIComponent(params.blockKey);
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arc}/blocks/${key}/select`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("POST blocks/[blockKey]/select — fetch failed:", err);
    return NextResponse.json(
      { error: "Selection service unavailable." },
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
