import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return proxyJson(`/v2/homework/session/${sessionId}/questions`, { method: "GET" }, req);
}
