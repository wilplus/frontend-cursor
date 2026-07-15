import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/user/snippets/[snippetId]/suggestion-feedback
 *
 * BFF proxy — records that the user applied / preferred a Say-It-Stronger
 * suggestion (or applied all) on an instant-view piece (#190). Body:
 * { session_id, target, action, upgrade_index?, suggestion_version }.
 * PUBLIC / guest — the readout is walkable on an unclaimed session, so auth is
 * forwarded when present but never required. Fire-and-forget on the client;
 * status + body are relayed verbatim so the client reads { saved: bool }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { snippetId: string } }
) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const token = await getV2AccessToken(req); // optional — guest-allowed
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const id = encodeURIComponent(params.snippetId);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/user/snippets/${id}/suggestion-feedback`,
      { method: "POST", headers, body: body || "{}", cache: "no-store" }
    );
  } catch (err) {
    console.error(
      "POST /api/v2/user/snippets/[snippetId]/suggestion-feedback — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Feedback service unavailable." },
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
