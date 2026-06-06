import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/coach/sessions/<session_id>/video
 *
 * Multipart proxy for the coach video upload (§B.5 / §F.6). Verbatim
 * pass-through to `POST /v2/coach/sessions/<sid>/video` on the BE.
 *
 * The BE reuses its existing user-video upload pipeline (storage bucket,
 * MIME whitelist, size limits) — this proxy is a thin pass-through, no
 * client-side transcoding, no FE-side validation beyond what the
 * <input type="file"> already does.
 *
 * Body: multipart/form-data
 *   - video_file (required, binary) — webm/mp4 typical; BE accepts the
 *     same MIME whitelist as user videos.
 *
 * Response 200: { video_ref } (BE-defined; FE persists on
 *                CoachReviewSession.videoRef and renders via <video>).
 *
 * Authorization is server-enforced via `require_admin_or_coach` upstream
 * + the session-ownership check (BE confirms the session is in this
 * coach's queue before accepting the upload).
 *
 * 401 UNAUTHENTICATED — caller has no auth token
 * 403 — caller is signed in but not a coach (or not THIS session's coach)
 * 504 UPSTREAM_TIMEOUT — our 25s inner abort fired before Vercel's 30s
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
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

    // Re-emit the FormData against the upstream URL. We re-build the
    // form instead of streaming the raw body because Node's fetch
    // needs to set its own multipart boundary; reusing the inbound
    // Content-Type header would carry the wrong boundary marker and
    // the upstream parser would 400.
    const out = new FormData();
    for (const [key, value] of inbound.entries()) {
      out.append(key, value);
    }

    const sid = encodeURIComponent(params.sessionId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/coach/sessions/${sid}/video`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: out,
        signal: controller.signal,
        cache: "no-store",
      });
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
      `coach_video.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-video-v1",
      },
      { status: 500 }
    );
  }
}
