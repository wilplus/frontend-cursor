import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;
  const body = await req.json();
  return proxyJson(`/v2/session/${sessionId}/intent`, { method: "POST", body }, req);
}
