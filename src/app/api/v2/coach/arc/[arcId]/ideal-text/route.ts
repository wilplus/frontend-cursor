import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET/PUT /api/v2/coach/arc/[arcId]/ideal-text
 *
 * BFF proxy — the coach's ONE-BLOCK ideal text (delivery layer). GET returns
 * the auto-assembled draft merged with any saved coach edit; PUT saves the
 * coach's edit. Coach-gated upstream.
 */
async function relay(
  req: NextRequest,
  arcId: string,
  method: "GET" | "PUT"
): Promise<NextResponse> {
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

  const id = encodeURIComponent(arcId);
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  };
  if (method === "PUT") init.body = (await req.text()) || "{}";

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/coach/arc/${id}/ideal-text`, init);
  } catch (err) {
    console.error(
      `${method} /api/v2/coach/arc/[arcId]/ideal-text — fetch failed:`,
      err
    );
    return NextResponse.json(
      { error: "Ideal-text service unavailable." },
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

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  return relay(req, params.arcId, "GET");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  return relay(req, params.arcId, "PUT");
}
