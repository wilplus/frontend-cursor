import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function GET(req: NextRequest) {
  return proxyJson("/session/status", undefined, req);
}

