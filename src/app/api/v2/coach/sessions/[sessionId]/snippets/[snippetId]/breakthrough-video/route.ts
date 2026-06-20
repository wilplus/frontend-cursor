import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/coach/sessions/<session_id>/snippets/<snippet_id>/breakthrough-video
 *
 * Multipart proxy for the per-snippet breakthrough video the coach attaches
 * during review. Verbatim pass-through to
 *   POST /v2/coach/sessions/<sid>/snippets/<nid>/breakthrough-video
 * on the BE, mirroring the session-level coach video upload.
 *
 * NOTE: the BE upload endpoint is Phase 2 and may not be live yet. Until it
 * ships, upstream returns 404 and the FE surfaces a retry — no broken state.
 *
 * Body: multipart/form-data — video_file (binary). Response 200:
 *   { breakthrough_video_ref } (a public URL; FE saves it via the per-snippet
 *   save). Auth is server-enforced (require_admin_or_coach + session ownership).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } }
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

    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json(
        { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
        { status: 400 }
      );
    }

    // Re-build the form so Node's fetch sets its own multipart boundary.
    const out = new FormData();
    for (const [key, value] of inbound.entries()) {
      out.append(key, value);
    }

    const sid = encodeURIComponent(params.sessionId);
    const nid = encodeURIComponent(params.snippetId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let upstream: Response;
    try {
      upstream = await fetch(
        `${backend}/v2/coach/sessions/${sid}/snippets/${nid}/breakthrough-video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: out,
          signal: controller.signal,
          cache: "no-store",
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          code: "UPSTREAM_TIMEOUT",
          error: "Upload took too long. Try again in a moment.",
        },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      `breakthrough_video.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "breakthrough-video-v1",
      },
      { status: 500 }
    );
  }
}
