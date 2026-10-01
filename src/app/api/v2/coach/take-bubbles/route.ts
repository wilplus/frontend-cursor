import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 0c (founder 2026-10-01, A2): a student's new Take as a bubble in the
// coach's Lounge chat. Dark (404) until COACH_TAKE_BUBBLES_ENABLED.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/coach/take-bubbles", "GET");
}
