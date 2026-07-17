import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v2/coach/arc/[arcId]/publish
 *
 * BFF proxy — the arc-level "Publish the full analysis" action. Relays to the
 * BE's publish-analysis (FE-4 — the old /publish path was #186's, deleted in
 * #195; the BE briefly aliased it back while this relay caught up). The BE
 * gates on all takes saved + the ideal text approved and answers 409 with
 * TAKES_NOT_SAVED / IDEAL_TEXT_NOT_APPROVED otherwise; status + body relay
 * verbatim so the FE surfaces the server's own message.
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
    upstream = await fetch(`${backend}/v2/coach/arc/${id}/publish-analysis`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("POST /api/v2/coach/arc/[arcId]/publish — fetch failed:", err);
    return NextResponse.json({ error: "Publish service unavailable." }, { status: 502 });
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
