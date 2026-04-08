import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object") {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  return proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: "/v2/admin/acoustic-dojo/labels",
    body,
  });
}

