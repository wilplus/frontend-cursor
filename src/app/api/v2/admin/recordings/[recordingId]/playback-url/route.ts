import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/admin/recordings/[recordingId]/playback-url
 *
 * Returns a playable URL for the recording's audio file.
 * Proxies to backend GET /v2/admin/recordings/<id>/playback-url
 * which generates the signed URL via the service-role Supabase client
 * (bypassing the RLS that was blocking the previous direct query).
 *
 * The previous version of this BFF queried Supabase directly:
 *   - Wrong table name: it queried `recording_1` (table is `recordings`)
 *   - Wrong client: anon-key with RLS denying authenticated reads
 * Both compounded to a 404 even when the recording row existed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." },
      { status: 502 }
    );
  }

  const id = encodeURIComponent(params.recordingId);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/v2/admin/recordings/${id}/playback-url`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error("GET /api/v2/admin/recordings/[id]/playback-url — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Recording service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
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
