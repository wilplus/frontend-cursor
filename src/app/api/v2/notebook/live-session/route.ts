import "server-only";
import { NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/notebook/live-session: a short-lived key to stream a voice
 * note being said to the transcription provider, relayed to
 * `POST /v2/notebook/live-session`. The backend issues it under the caller's
 * processing authorization and keeps nothing (backend N392).
 */
export const runtime = "nodejs";
export const maxDuration = 15;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Took too long. Try again in a moment." } },
};
const RELAY = relayLenient();

export async function POST() {
  const token = await getAccessToken();
  if (!token) return failure(FAILURES.unauthenticated!);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    return await callBackend("/v2/notebook/live-session", {
      method: "POST",
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
