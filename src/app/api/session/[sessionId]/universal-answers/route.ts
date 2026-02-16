import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

type Params = { params: { sessionId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const { sessionId } = params;
  const body = await req.json();
  return proxyJson(`/v2/session/${sessionId}/universal-answers`, { method: "POST", body }, req);
}
