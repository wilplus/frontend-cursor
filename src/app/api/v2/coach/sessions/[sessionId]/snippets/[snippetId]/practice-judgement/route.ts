import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { relayJson } from "@/app/api/_lib/afterPracticeRelay";

export const runtime = "nodejs";
export const maxDuration = 30;

// The coach's answer on the speaker's chosen practice recording (founder
// 2026-10-05, Q6). The backend keeps it behind the blind gate.
function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/practice-judgement`;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
): Promise<NextResponse> {
  return relayJson(req, path(params.sessionId, params.snippetId), "PUT");
}
