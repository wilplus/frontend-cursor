import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  const { cohortId } = await params;
  if (!cohortId || !cohortId.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing cohortId" },
      { status: 400 }
    );
  }
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/cohorts/${encodeURIComponent(cohortId)}/students${qs}`,
  });
}

