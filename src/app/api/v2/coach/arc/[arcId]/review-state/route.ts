import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/arc/[arcId]/review-state
 *
 * BFF proxy — the coach wrap-up screen's single read (FE-2). Relays
 * `GET /v2/coach/arc/<arcId>/review-state`, which returns per-take review
 * states, the ideal-text assembly/approval status, and `can_publish` +
 * `blockers` (mirroring exactly what publish-analysis enforces) so the wrap-up
 * renders the button's real state instead of discovering it on a failed POST.
 * Coach-gated upstream. Soft-fails to 502 on any transport/parse failure.
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
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.arcId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/arc/${id}/review-state`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      `GET /api/v2/coach/arc/[arcId]/review-state — fetch failed:`,
      err
    );
    return NextResponse.json(
      { error: "Review-state service unavailable." },
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
