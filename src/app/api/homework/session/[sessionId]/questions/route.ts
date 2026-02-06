import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockQuestionsResponse,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (useMockHomework()) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    return Response.json(mockQuestionsResponse());
  }
  const { sessionId } = await params;
  const res = await proxyJson(`/v2/homework/session/${sessionId}/questions`, { method: "GET" }, req);
  if (res.status === 404) return Response.json(mockQuestionsResponse());
  return res;
}
