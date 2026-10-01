import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 7 (founder 2026-10-01, C5-a): a draft of the coach's personal line on
// a moment, after the blind rating. Dark (404) until COACH_WORD_PAIRS_ENABLED.
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
): Promise<NextResponse> {
  return relayJson(
    req,
    `/v2/coach/sessions/${encodeURIComponent(params.sessionId)}/snippets/${encodeURIComponent(params.snippetId)}/moment-line/draft`,
    "POST",
  );
}
