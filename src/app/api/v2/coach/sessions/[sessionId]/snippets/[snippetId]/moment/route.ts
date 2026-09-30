import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

// The coach's Read screen, one source (founder 2026-09-30; P2-10). A plain
// pass-through: the backend enforces the coach's own blind rating first and
// answers 409 BLIND_RATING_REQUIRED before it.
function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/moment`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  return callBackend(path(params.sessionId, params.snippetId), { method: "GET" });
}
