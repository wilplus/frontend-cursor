import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  let body: { metric_answer_1: string; metric_answer_2: string } = {
    metric_answer_1: "",
    metric_answer_2: "",
  };
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // keep defaults
  }
  return proxyJson(`/v2/homework/session/${sessionId}/metric-answers`, {
    method: "POST",
    body,
  }, req);
}
