import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const maxDuration = 30;

export const runtime = "nodejs";

/**
 * POST /api/coaching/trial-recording
 *
 * Multipart proxy for the trial re-performance audio. Forwards the
 * incoming FormData (audio_file + coaching_id) to
 * `POST /v2/coaching/trial-recording`. The backend uploads to S3,
 * creates a v2_session + recording row, runs extract_recording_snippets,
 * and marks the coaching session complete.
 *
 * On success the new snippets surface on /results via the standard
 * timeline query — closing the retention loop.
 *
 * 201: { status: "ok", coaching_id, trial_session_id, recording_id }
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Sign-in required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Trial upload service unavailable." } },
  timeout: { status: 504, body: { code: "TIMEOUT", error: "Upload timed out after 60 seconds." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest) {
  // Sign-in is checked before the body is read, as it always was.
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
      { status: 400 }
    );
  }

  // 60s timeout — same budget as the cold-start funnel upload.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    // No Content-Type here — fetch sets the multipart boundary.
    return await callBackend("/v2/coaching/trial-recording", {
      method: "POST",
      body: formData,
      signal: controller.signal,
      token,
      failures: FAILURES,
      relay: RELAY,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
