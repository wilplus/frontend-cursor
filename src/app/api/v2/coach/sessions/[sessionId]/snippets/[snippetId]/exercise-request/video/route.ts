import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/coach/sessions/<sid>/snippets/<snip>/exercise-request/video
 *
 * The video a coach adds to a written answer (founder 2026-09-30, A5; 0403).
 * Multipart pass-through to the backend, the same shape as the exercise video
 * proxy; the backend enforces the blind gate, the size and the type.
 *
 * Body: multipart/form-data with `video_file`. 200 { video_url }.
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
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  try {
    const token = await getAccessToken();
    if (!token) return failure(FAILURES.unauthenticated!);
    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
    }
    const out = new FormData();
    for (const [key, value] of inbound.entries()) out.append(key, value);
    const path = `/v2/coach/sessions/${encodeURIComponent(params.sessionId)}/snippets/${encodeURIComponent(params.snippetId)}/exercise-request/video`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      return await callBackend(path, {
        method: "POST", body: out, signal: controller.signal, token, failures: FAILURES, relay: RELAY,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`coach_answer_video.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach-answer-video-v1" },
      { status: 500 },
    );
  }
}
