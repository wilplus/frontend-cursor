import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/speakers: every speaker this coach may hear, by pseudonym,
 * with their goal, what waits and which Takes are answered (coach panel lock,
 * flow 1 and 3: the pinned Speakers button; build plan D-CP-12). Verbatim
 * pass-through; the backend enforces the coach role and the language gate,
 * sends no name, email or user_id, and nothing about any moment (BLIND COACH).
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Speakers service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(_req: NextRequest) {
  try {
    return await callBackend("/v2/coach/speakers", { method: "GET", failures: FAILURES, relay: RELAY });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`coach_speakers.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach_speakers-v1" },
      { status: 500 },
    );
  }
}
