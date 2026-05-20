import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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
export async function POST(req: NextRequest) {
  const accessToken = await getV2AccessToken(req);
  if (!accessToken) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Sign-in required." },
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "INVALID_MULTIPART", error: "Invalid multipart payload." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    // 60s timeout — same budget as the cold-start funnel upload.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    upstream = await fetch(`${backendUrl}/v2/coaching/trial-recording`, {
      method: "POST",
      headers: {
        // DO NOT set Content-Type — fetch sets the multipart boundary.
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { code: "TIMEOUT", error: "Upload timed out after 60 seconds." },
        { status: 504 }
      );
    }
    console.error("POST /api/coaching/trial-recording — fetch failed:", err);
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Trial upload service unavailable." },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        code: "UPSTREAM_NON_JSON",
        error: `Unexpected backend response (HTTP ${upstream.status}).`,
      },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
