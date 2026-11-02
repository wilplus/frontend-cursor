import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/explore/arc/:arcId/will-question/voice: an answer to Will's
 * open question by voice (multipart: audio, duration_ms, take_session_id),
 * relayed to `POST /v2/explore/arc/:arcId/will-question/voice` (backend N294
 * items 2 and 3, N314, N319 item 1). The backend hears it under the caller's
 * processing authorization and writes the speaker's voice bubble with the
 * words and Will's reply into the Lounge; the recording is not kept.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Took too long. Try again in a moment." } },
};
const RELAY = relayLenient();

export async function POST(req: NextRequest, { params }: { params: { arcId: string } }) {
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);
  const { arcId } = params;
  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
  }
  // Rebuilt so Node's fetch sets its own multipart boundary.
  const out = new FormData();
  for (const [key, value] of inbound.entries()) out.append(key, value);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);
  try {
    return await callBackend(`/v2/explore/arc/${encodeURIComponent(arcId)}/will-question/voice`, {
      method: "POST",
      body: out,
      signal: controller.signal,
      token,
      failures: FAILURES,
      relay: RELAY,
    });
  } catch {
    return NextResponse.json({ code: "BACKEND_UNAVAILABLE", error: "Backend unreachable" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
