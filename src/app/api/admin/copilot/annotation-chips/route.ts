import { NextRequest } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/annotation-chips${qs}`,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object") {
    return Response.json(
      { code: "BAD_REQUEST", error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  return proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: "/v2/admin/copilot/annotation-chips",
    body,
  });
}

