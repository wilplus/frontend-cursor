import { NextRequest } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search || "";
  return proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/acoustic-dojo/next-clips${qs}`,
  });
}

