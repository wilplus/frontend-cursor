import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/queue/moments
 *
 * BFF proxy for the coach's queue of moments (founder 2026-09-30; P2-6).
 * Verbatim pass-through to `GET /v2/coach/queue/moments`: speakers oldest
 * first, their takes, each bookmarked moment with one state word, and the
 * kind only once this coach has rated it. The backend enforces the coach
 * role and the rater's languages (428).
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coach queue service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(_req: NextRequest) {
  try {
    return await callBackend("/v2/coach/queue/moments", {
      method: "GET",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_queue_moments.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err,
    );
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach-queue-moments-v1" },
      { status: 500 },
    );
  }
}
