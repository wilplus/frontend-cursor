import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

// One model draft per request, by its kind (founder 2026-09-30; P2-2). A plain
// pass-through: the backend enforces the coach's blind rating first.
function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/exercise-request/draft`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  return callBackend(path(params.sessionId, params.snippetId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
