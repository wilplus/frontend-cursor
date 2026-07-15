import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/ideal-text/notes
 *
 * BFF proxy — the user's PERSONAL notebook copy of the ideal text (A6). Never
 * touches the coach-approved canonical (L1). Body {text} relayed verbatim.
 */
export async function PUT(
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
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/explore/arc/${id}/ideal-text/notes`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "PUT /api/v2/explore/arc/[arcId]/ideal-text/notes — fetch failed:",
      err
    );
    return NextResponse.json(
      { error: "Notes service unavailable." },
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
