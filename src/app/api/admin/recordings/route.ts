import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { AdminRecordingsListResponse } from "@/lib/api/types";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const path = `/admin/recordings${search ? `?${search}` : ""}`;
  
  console.log(`[API /admin/recordings] Fetching: ${path}`);
  
  return proxyJson<AdminRecordingsListResponse>(path);
}
