import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const { id, draftId } = await params;
  if (!id || !id.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing id" }, { status: 400 });
  }
  if (!draftId || !draftId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing draftId" }, { status: 400 });
  }
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/students/${encodeURIComponent(id)}/drafts/${encodeURIComponent(draftId)}/pipeline-status${qs}`,
  });
}

