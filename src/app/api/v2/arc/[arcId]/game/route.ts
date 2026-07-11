import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/arc/[arcId]/game?snippet=<id>
 *
 * BFF proxy — the key-moment game session (E5, $25-gated). Forwards status +
 * body faithfully: 402 → paywall, 404/501 → coming-soon (the FE maps both).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  const id = encodeURIComponent(params.arcId);
  const snippet = req.nextUrl.searchParams.get("snippet");
  const qs = snippet ? `?snippet=${encodeURIComponent(snippet)}` : "";
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/arc/${id}/game${qs}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/arc/[arcId]/game — fetch failed:", err);
    return NextResponse.json({ error: "Game service unavailable." }, { status: 502 });
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
