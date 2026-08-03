import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/ideal-text/revisions/[revision]/restore
 *
 * BFF proxy — repoint the composition head at what an earlier revision
 * recorded. Restore never deletes: the answer carries a NEW head revision
 * (restore is itself history, and is itself undoable). Status passthrough:
 * 404 = flag off / not owner / revision unknown → silent refetch FE-side.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; revision: string } }
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
  const arc = encodeURIComponent(params.arcId);
  const rev = encodeURIComponent(params.revision);
  let upstream: Response;
  try {
    upstream = await fetch(
      `${backend}/v2/explore/arc/${arc}/ideal-text/revisions/${rev}/restore`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("POST revisions/[revision]/restore — fetch failed:", err);
    return NextResponse.json(
      { error: "Restore service unavailable." },
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
