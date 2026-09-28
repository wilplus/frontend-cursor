import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

// A moment no exercise fitted (backend 2026-09-28). A plain pass-through: the
// backend enforces the coach's blind rating and the speaker's practice choice.
function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  return callBackend(path(params.sessionId, params.snippetId), { method: "GET" });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  return callBackend(path(params.sessionId, params.snippetId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
