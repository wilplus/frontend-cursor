import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/coach/exercises/<exercise_id>/video
 *
 * Multipart proxy for the exercise video (founder 2026-09-29, decision 4).
 * Verbatim pass-through to `POST /v2/coach/exercises/<id>/video`, the same
 * shape as the coach session video proxy.
 *
 * Body: multipart/form-data
 *   - video_file (required) — .mp4/.mov/.webm/.m4v
 *   - exercise (optional, JSON) — the definition. Required for a NEW
 *     exercise, since the library refuses one without a video and the video
 *     needs an exercise to attach to: the first save is this one call. For an
 *     existing exercise it is an edit merged over the live row.
 *
 * Response 200: { exercise, version, transcript_status } — the video is
 * stored, hashed, saved as a new version and transcribed at upload under the
 * coach's own processing authorization; a missing authorization is recorded,
 * never a failure.
 *
 * 400 — a refusal, readable (checked before anything is stored)
 * 404 — no such exercise and no definition
 * 413 / 415 — too large / not a video
 * 401 UNAUTHENTICATED — caller has no auth token
 * 403 — caller is signed in but not a coach
 * 504 UPSTREAM_TIMEOUT — our 25s inner abort fired before Vercel's 30s
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Upload took too long. Try again in a moment." } },
};
const RELAY = relayLenient();

export async function POST(
  req: NextRequest,
  { params }: { params: { exerciseId: string } }
) {
  try {
    const token = await getAccessToken();
    if (!token) return failure(FAILURES.unauthenticated!);

    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json(
        { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
        { status: 400 }
      );
    }

    // Re-emitted rather than streamed: Node's fetch sets its own multipart
    // boundary, and the inbound Content-Type would carry the wrong one.
    const out = new FormData();
    for (const [key, value] of inbound.entries()) {
      out.append(key, value);
    }

    const id = encodeURIComponent(params.exerciseId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      return await callBackend(`/v2/coach/exercises/${id}/video`, {
        method: "POST",
        body: out,
        signal: controller.signal,
        token,
        failures: FAILURES,
        relay: RELAY,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_exercise_video.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-exercise-video-v1",
      },
      { status: 500 }
    );
  }
}
