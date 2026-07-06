import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/arc/[arcId]/unlock
 *
 * BFF proxy — spend credits to unlock an arc's paid deliverables (ideal text,
 * breakthroughs list, game, library). The backend does the atomic claim +
 * conditional credit deduct; this route just forwards the call + preserves the
 * status so the FE can branch:
 *   200 { unlocked, arc_id, credits_remaining } — success
 *   200 { already_entitled: true, arc_id }      — pre-check: already paid (a success)
 *   409 ARC_ALREADY_PAID                        — raced double-tap (a success)
 *   402 { code: INSUFFICIENT_CREDITS, required, current } — a clean paywall, NEVER an error
 *
 * This forwards status + body faithfully; a 404 → the FE shows a soft retry
 * notice and keeps the pricing-page top-up fallback.
 */
export async function POST(
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
    upstream = await fetch(`${backend}/v2/arc/${id}/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/arc/[arcId]/unlock — fetch failed:", err);
    return NextResponse.json({ error: "Unlock service unavailable." }, { status: 502 });
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
