import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * DELETE /api/v2/admin/users/[userId]/files/[fileId]
 *
 * BFF proxy for the admin soft-delete endpoint (BE bb2a7c1). Sets
 * deleted_at on the row; the next GET excludes it. R2 bytes are
 * retained for the recovery window — a separate weekly cron does
 * the hard delete (not yet shipped per BE handoff).
 *
 * Owner-scoped on the BE: a file_id belonging to a different user
 * returns 404 (not 403) so existence can't be enumerated. Same
 * 404 for "already soft-deleted" — admin sees a single uniform
 * "file not found" path.
 *
 * Response:
 *   204                       success
 *   400 INVALID_INPUT         bad UUID
 *   404 FILE_NOT_FOUND        wrong owner OR already deleted
 *   500 V2_ERROR              anything else
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string; fileId: string } }
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

  const userId = encodeURIComponent(params.userId);
  const fileId = encodeURIComponent(params.fileId);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${backendUrl}/v2/admin/users/${userId}/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    console.error(
      "DELETE /api/v2/admin/users/[id]/files/[fid] — fetch failed:",
      err
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Files service unavailable." },
      { status: 502 }
    );
  }

  // 204 has no body — pass status through directly.
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
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
