import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 8 (founder 2026-10-01, C5-b): this coach's pending block picks, audio
// only. Dark (404) until COACH_BLOCK_PICK_ENABLED.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return relayJson(req, "/v2/coach/block-picks", "GET");
}
