import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  if (!jobId || !jobId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing jobId" }, { status: 400 });
  }
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/reference-videos/upload-jobs/${encodeURIComponent(jobId.trim())}`,
  });
}
