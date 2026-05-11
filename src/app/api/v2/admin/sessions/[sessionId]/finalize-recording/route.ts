import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/admin/sessions/[sessionId]/finalize-recording
 *
 * Concatenates per-turn interview audio for the session into one canonical
 * .webm file and rewrites the session's interview-turn snippet anchors to
 * point into that single file. Backfill / manual-trigger entry point for
 * the migration toward "snippets are slices of one canonical recording".
 *
 * Proxies to backend POST /v2/admin/sessions/<id>/finalize-recording, which
 * wraps services.session_concatenation.finalize_session_recording. Idempotent
 * — re-invoking on an already-finalized session re-uploads the same storage
 * key and rewrites the same offsets, so the button is safe to spam.
 *
 * Response mirrors the backend payload: storage_path, duration_ms, per-turn
 * offsets/durations, and counts of rewritten vs failed rows.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
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

    const response = await fetch(
      `${backend}/v2/admin/sessions/${sessionId}/finalize-recording`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Finalize session recording API error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}
