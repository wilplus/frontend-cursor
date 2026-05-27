import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/user/chat/upload-answer
 *
 * Multipart proxy for the post-labeling continuation recording —
 * distinct from `/api/public/interview/upload-answer` (which serves
 * the anonymous onboarding funnel) and from `/api/v2/coaching/trial-
 * recording` (the roleplay practice surface). Same MediaRecorder
 * pipeline on the FE; different backend destination because this
 * recording attaches to the snippet the user just labeled.
 *
 * Body: multipart/form-data
 *   - audio_file (required, binary)
 *   - source_snippet_id (required, uuid) — the just-labeled snippet
 *   - intent, question_text — optional analytics/cosmetic fields
 *
 * Response 200: { session_id, recording_id, ... } (BE-defined)
 *
 * 401 UNAUTHENTICATED — caller had no auth token
 * 409 + code "PRIOR_SESSION_PENDING_REVIEW" — B2 gate; backend says
 *     the user has a prior session still under admin review and
 *     can't start another upload until that one publishes. FE
 *     handles this by toasting + disabling the mic.
 * 504 UPSTREAM_TIMEOUT — our 25s inner abort fired before Vercel's
 *     30s outer slammed the door.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let upstream: Response;
    try {
      upstream = await fetch(`${backend}/v2/user/chat/upload-answer`, {
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
      `upload_answer.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "user-chat-upload-answer-v1",
      },
      { status: 500 }
    );
  }
}
