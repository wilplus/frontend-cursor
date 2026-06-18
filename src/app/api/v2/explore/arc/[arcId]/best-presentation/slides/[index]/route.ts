import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/best-presentation/slides/[index]
 *
 * BFF proxy — persists a coach-edited composed text for one slide.
 * Body: { text: string }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string; index: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const arcId = encodeURIComponent(params.arcId);
  const index = encodeURIComponent(params.index);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arcId}/best-presentation/slides/${index}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    console.error("PUT /api/v2/explore/arc/[arcId]/best-presentation/slides/[index] — fetch failed:", err);
    return NextResponse.json({ error: "Slide-save service unavailable." }, { status: 502 });
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
