import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

function badRequest(message: string) {
  return NextResponse.json({ code: "BAD_REQUEST", error: message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !id.trim()) return badRequest("Missing id");
  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object") return badRequest("Invalid JSON body");
  return proxyAdminWithCodes(request, {
    method: "PATCH",
    backendPath: `/v2/admin/students/${encodeURIComponent(id)}/profile-classification`,
    body,
  });
}
