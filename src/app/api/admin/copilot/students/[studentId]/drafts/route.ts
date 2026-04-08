import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

function badRequest(message: string) {
  return NextResponse.json({ code: "BAD_REQUEST", error: message }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts${qs}`,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) return badRequest("Missing studentId");
  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object") {
    return badRequest("Invalid JSON body");
  }
  return proxyAdminWithCodes(request, {
    method: "PUT",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts`,
    body,
  });
}

