import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * DELETE /api/v2/user/presentations/[presentationId]/takes/[takeNumber]
 *
 * BFF proxy — deletes a single take from a presentation.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { presentationId: string; takeNumber: string } }
) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Not authenticated" }, { status: 401 });
  }

  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/user/presentations/${params.presentationId}/takes/${params.takeNumber}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch (err) {
    console.error(
      "DELETE /api/v2/user/presentations/[presentationId]/takes/[takeNumber] — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Presentations service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
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
  }
  return NextResponse.json(data, { status: upstream.status });
}
