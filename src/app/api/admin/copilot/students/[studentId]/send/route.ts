import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  if (!studentId || !studentId.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing studentId" },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => ({}));
  return proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: `/v2/admin/copilot/students/${encodeURIComponent(studentId)}/send`,
    body,
  });
}

