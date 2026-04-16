import { NextRequest } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return proxyAdminWithCodes(request, {
    method: "POST",
    backendPath: "/v2/admin/copilot/reference-videos/upload-url",
    body,
  });
}
