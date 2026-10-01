import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// Phase 1b (founder 2026-10-01, F8): the exercise the machine served on a
// moment and the pool it could swap to; the coach's explicit keep, swap or
// new. Dark on the backend (404) until COACH_EXERCISE_PREFERENCE_ENABLED.
function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-preference`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
): Promise<NextResponse> {
  return relayJson(req, path(params.sessionId, params.snippetId), "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
): Promise<NextResponse> {
  return relayJson(req, path(params.sessionId, params.snippetId), "POST");
}
