import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

/** GET task-block for step 2 (e.g. when resuming). Returns task_block with metric_question_1, metric_question_2, metric_question_3. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const res = await proxyJson(`/v2/homework/session/${sessionId}/task-block`, undefined, req);
  return res;
}
