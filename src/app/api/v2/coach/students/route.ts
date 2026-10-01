import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/students: the coach's roster (founder 2026-10-01, Phase 0b). Verbatim pass-through; the
 * backend enforces the coach role, and sends a student's real name only
 * when Phase 0b is on there.
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Students service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(_req: NextRequest) {
  try {
    return await callBackend("/v2/coach/students", { method: "GET", failures: FAILURES, relay: RELAY });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`coach_students.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach_students-v1" },
      { status: 500 },
    );
  }
}
