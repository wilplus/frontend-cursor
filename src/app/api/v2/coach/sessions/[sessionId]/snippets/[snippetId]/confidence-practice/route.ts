import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 30;

function path(sessionId: string, snippetId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/snippets/${encodeURIComponent(snippetId)}/confidence-practice`;
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

// Naming an error on the moment, or undoing what attaching taught the library
// (founder 2026-09-25). Same pass-through; the backend dispatches it after the
// review's own blind gate.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string; snippetId: string } },
) {
  return callBackend(path(params.sessionId, params.snippetId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
