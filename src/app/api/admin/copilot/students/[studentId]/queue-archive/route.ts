import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

type Ctx = { params: Promise<{ studentId: string }> };

function badRequest(message: string) {
  return NextResponse.json({ code: "BAD_REQUEST", error: message }, { status: 400 });
}

async function parsePayload(request: NextRequest): Promise<{ session_id: string; sessionId: string } | NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
  const record = body as Record<string, unknown>;
  const fromSnake = typeof record.session_id === "string" ? record.session_id.trim() : "";
  const fromCamel = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const sessionId = fromSnake || fromCamel;
  if (!sessionId) return badRequest("Missing session_id");
  return { session_id: sessionId, sessionId: sessionId };
}

export async function POST(request: NextRequest, context: Ctx) {
  const { studentId } = await context.params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const payload = await parsePayload(request);
  if (payload instanceof NextResponse) return payload;
  return proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/queue-archive`,
    body: payload,
  });
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const { studentId } = await context.params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const payload = await parsePayload(request);
  if (payload instanceof NextResponse) return payload;
  return proxyAdminWithCodes(request, {
    method: "DELETE",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/queue-archive`,
    body: payload,
  });
}
