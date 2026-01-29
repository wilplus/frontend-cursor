import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { UserAdminContext } from "@/lib/api/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId;
  const path = `/admin/user/${userId}/context`;
  
  console.log(`[API /admin/user/${userId}/context] Fetching admin context`);
  
  return proxyJson<UserAdminContext>(path, undefined, req);
}
