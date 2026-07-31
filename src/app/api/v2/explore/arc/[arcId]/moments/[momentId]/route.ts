import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/moments/[momentId]
 *
 * BFF proxy — a key moment's coach explanation (note and/or video), the
 * single-deliverable model's ONLY paid item. Relays the BE's 402 (not
 * entitled) verbatim so the FE renders the unlock prompt. The BE still echoes
 * a legacy `price_credits` on that 402; the FE ignores it and quotes the
 * published TOKEN price instead. Soft-fails to 502 on transport failures.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string; momentId: string } }
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
  const a = encodeURIComponent(params.arcId);
  const m = encodeURIComponent(params.momentId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/explore/arc/${a}/moments/${m}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/explore/arc/[arcId]/moments — fetch failed:", err);
    return NextResponse.json(
      { error: "Moment service unavailable." },
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
