import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 6a (founder 2026-10-01, F6): this coach's pending blind error checks.
// Dark (404) until ERROR_PRESENCE_AUDIT_ENABLED.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/coach/error-audit", "GET");
}
