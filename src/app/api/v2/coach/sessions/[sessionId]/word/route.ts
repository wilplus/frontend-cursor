import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

// A word for this Take (founder 2026-09-30, B3; P2-5): the coach's one
// optional message and video per Take. A plain pass-through.
function path(sessionId: string): string {
  return `/v2/coach/sessions/${encodeURIComponent(sessionId)}/word`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  return callBackend(path(params.sessionId), { method: "GET" });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  return callBackend(path(params.sessionId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: (await req.text()) || "{}",
  });
}
