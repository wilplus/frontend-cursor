import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/** GET report for completed session (step 5): report_text, scores, final_recording with fresh audio_url. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;
  const { sessionId } = await params;
  return proxyJson(`/v2/homework/session/${sessionId}/report`, { method: "GET" }, req);
}
