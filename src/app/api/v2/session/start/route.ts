import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function POST(req: NextRequest) {
  let body: { session_id?: string } | null = null;
  const contentType = req.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      body = await req.json();
    } catch {
      body = null;
    }
  }
  return proxyJson("/v2/session/start", { method: "POST", body }, req);
}
