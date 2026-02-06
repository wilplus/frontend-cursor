import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockMetricAnswersResponse,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        await req.json();
      }
    } catch {
      // consume body
    }
    return Response.json(mockMetricAnswersResponse());
  }
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
  const res = await proxyJson(`/v2/homework/session/${sessionId}/metric-answers`, {
    method: "POST",
    body,
  }, req);
  if (res.status === 404) return Response.json(mockMetricAnswersResponse());
  return res;
}
