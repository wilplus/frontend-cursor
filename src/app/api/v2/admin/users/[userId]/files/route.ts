import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/v2/admin/users/[userId]/files
 *
 * BFF proxy for the canonical admin Files endpoint (BE pre-task-9
 * read + BE bb2a7c1 pagination). Replaces the older /uploads BFF on
 * the admin Tab 4 surface — richer shape: TTL-aware playback_url
 * (handles both public AND private R2 buckets via per-request signed
 * URLs), explicit file_type, total + has_more for paged loads.
 *
 * Forwards three query params verbatim when present:
 *   - limit          1..200, default 50 server-side
 *   - offset         default 0 server-side
 *   - expires_in     60..604800, default 3600 (1h) server-side.
 *                    FE defaults to 21600 (6h) on the initial fetch
 *                    so a long-open admin tab doesn't go stale.
 *
 * Response shape:
 *   {
 *     user_id, files: [...],
 *     limit, offset, total, has_more
 *   }
 *
 * Soft-deleted rows are filtered out BE-side (see migrations/
 * add_deleted_at_to_user_uploaded_files.sql), so this proxy doesn't
 * need any projection.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
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
  const search = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get("limit");
  const offset = req.nextUrl.searchParams.get("offset");
  const expiresIn = req.nextUrl.searchParams.get("expires_in");
  if (limit) search.set("limit", limit);
  if (offset) search.set("offset", offset);
  if (expiresIn) search.set("expires_in", expiresIn);
  const qs = search.toString();
  const upstreamPath = `/v2/admin/users/${userId}/files${qs ? `?${qs}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}${upstreamPath}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("GET /api/v2/admin/users/[id]/files — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Files service unavailable." },
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
