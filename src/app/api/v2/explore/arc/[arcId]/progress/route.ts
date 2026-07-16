import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/progress
 *
 * BFF proxy — cheap progress poll: { takes_done, takes_target, takes_remaining, ready }.
 * Polled by ProgressToAuditBubble for the take counter; the deliverable
 * affordances live on the BE terminal Lounge card (best_presentation_ready /
 * transcript_ready), not here.
 *
 * PUBLIC / guest (BE #199): a signed-out user recording an arc sees their own
 * take counter — the arc id is the capability. The token is forwarded when
 * present (signed-in scoping) but never required; the BE stays authoritative.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const token = await getV2AccessToken(req); // optional — guest-allowed
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  const id = encodeURIComponent(params.arcId);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/explore/arc/${id}/progress`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/explore/arc/[arcId]/progress — fetch failed:", err);
    return NextResponse.json({ error: "Progress service unavailable." }, { status: 502 });
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
