import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/arc/[arcId]/unlock-moments
 *
 * BFF proxy — the 5-credit key-moments unlock (the single-deliverable model's
 * one price). Debits 5 credits and entitles this presentation's moment
 * explanations forever; idempotent BE-side (already_entitled → 200). Status +
 * body relay verbatim (402/INSUFFICIENT_CREDITS drives the top-up path).
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
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }
  const id = encodeURIComponent(params.arcId);
  let upstream: Response;
  try {
    // Arc-keyed like its paired moments GET (and the old /v2/arc/<id>/unlock)
    // — the FE holds arc ids; "presentation" BE-side is the gutted arc entity.
    upstream = await fetch(`${backend}/v2/arc/${id}/unlock-moments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/arc/[arcId]/unlock-moments — fetch failed:", err);
    return NextResponse.json(
      { error: "Unlock service unavailable." },
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
