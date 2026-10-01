import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/students/:userId: a student's profile and Takes (founder 2026-10-01, Phase 0b). Verbatim pass-through; the
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

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    return await callBackend(`/v2/coach/students/${encodeURIComponent(params.userId)}`, { method: "GET", failures: FAILURES, relay: RELAY });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`coach_student_profile.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}`, bff_revision: "coach_student_profile-v1" },
      { status: 500 },
    );
  }
}
