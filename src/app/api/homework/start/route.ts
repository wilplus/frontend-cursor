import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockStartResponse,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    return Response.json(mockStartResponse());
  }
  return proxyJson("/v2/homework/start", { method: "POST", body: {} }, req);
}
