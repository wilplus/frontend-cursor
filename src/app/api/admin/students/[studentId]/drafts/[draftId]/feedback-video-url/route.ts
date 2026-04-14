import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string; draftId: string }> }
) {
  const { studentId, draftId } = await params;
  if (!studentId || !studentId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing studentId" }, { status: 400 });
  }
  if (!draftId || !draftId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing draftId" }, { status: 400 });
  }
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/students/${encodeURIComponent(studentId)}/drafts/${encodeURIComponent(draftId)}/feedback-video-url${qs}`,
  });
}

