import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyJson("/v2/homework/start", { method: "POST", body: {} }, req);
}
