import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/ideal-text/user-edit
 *
 * BFF proxy — persist the STUDENT's edit of their ideal text (#214). Body
 * {text, version}; 200 {saved, version}; 409 {code: "VERSION_SUPERSEDED",
 * current_version} when a newer version assembled mid-edit (the FE retries
 * against it — the student's edit always wins, locked founder rule). Status +
 * body relay verbatim.
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
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${id}/ideal-text/user-edit`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: (await req.text()) || "{}",
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "PUT /api/v2/explore/arc/[arcId]/ideal-text/user-edit — fetch failed:",
      err
    );
    return NextResponse.json(
      { error: "Edit service unavailable." },
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
