import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * GET /api/v2/lab/recordings/[sessionId]/readout
 *
 * BFF proxy — the GUEST readout re-read (BE-1, root of bugs 4 & 6). Optional
 * auth: an unclaimed (user_id IS NULL) lab session's readout is public via its
 * unguessable UUID (the same trust model as the rest of the guest funnel); a
 * claimed session requires its owner and 404s otherwise. Forwards status +
 * body faithfully — the FE client owns the envelope shape.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  // Optional auth — forward the token if present so an owner re-opening a
  // claimed session (or a guest's own unclaimed one) is scoped correctly.
  const token = await getV2AccessToken(req);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const id = encodeURIComponent(params.sessionId);
  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/lab/recordings/${id}/readout`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    console.error(
      "GET /api/v2/lab/recordings/[sessionId]/readout — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Lab service unavailable." },
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
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
