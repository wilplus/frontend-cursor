import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyJson("/session/abandon", { method: "POST", body }, req);
}

