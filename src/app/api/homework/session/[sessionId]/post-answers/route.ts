import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockPostAnswersResponse,
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
    return Response.json(mockPostAnswersResponse());
  }
  const { sessionId } = await params;
  let body: { answers: Array<{ question_id: string; answer_text: string }> } = { answers: [] };
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // keep defaults
  }
  return proxyJson(`/v2/homework/session/${sessionId}/post-answers`, {
    method: "POST",
    body,
  }, req);
}
