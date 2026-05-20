import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * GET /api/v2/admin/users/[userId]/uploads
 *
 * Admin listing of every user-uploaded media file (audio/video)
 * surfaced in the user-detail dashboard's Files tab. Proxies to
 * backend GET /v2/admin/users/<user_id>/uploads.
 *
 * Success 200:
 *   { uploads: Array<{
 *       id: string,
 *       filename: string,
 *       content_type: string,        // e.g. "audio/mpeg", "video/mp4"
 *       size_bytes: number | null,
 *       file_url: string,            // Cloudflare R2 public/signed URL
 *       duration_seconds: number | null,
 *       session_id: string | null,
 *       created_at: string           // ISO 8601
 *     }> }
 *
 * 401 UNAUTHENTICATED
 * 5xx — backend unavailable
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = encodeURIComponent(params.userId);
    const upstream = await fetch(
      `${backend}/v2/admin/users/${userId}/uploads`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("GET admin user uploads error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "admin-user-uploads-list-v1",
      },
      { status: 500 }
    );
  }
}
