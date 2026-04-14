import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ referenceVideoId: string }> }
) {
  const { referenceVideoId } = await params;
  if (!referenceVideoId || !referenceVideoId.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing referenceVideoId" },
      { status: 400 }
    );
  }
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/reference-videos/${encodeURIComponent(referenceVideoId)}/playback-url${qs}`,
  });
}

