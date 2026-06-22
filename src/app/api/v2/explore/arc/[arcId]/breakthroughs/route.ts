import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/breakthroughs
 *
 * BFF proxy (BE PR #145) — returns every coach-confirmed breakthrough moment in
 * this arc, newest→oldest, with playback data:
 *   { breakthroughs: [{ slide_index, title, text, audio_ref, start_offset_ms,
 *     duration_ms, breakthrough_note, take_index, ... }], presentation_ref }.
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
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/explore/arc/${id}/breakthroughs`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/explore/arc/[arcId]/breakthroughs — fetch failed:", err);
    return NextResponse.json({ error: "Breakthroughs service unavailable." }, { status: 502 });
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
