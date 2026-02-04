import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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
