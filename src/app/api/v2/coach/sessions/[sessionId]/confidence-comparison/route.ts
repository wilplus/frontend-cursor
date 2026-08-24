import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** Founder-only post-label audit. This is intentionally a separate route from
 * the blind queue: joining the machine snapshot into that payload would make
 * it possible for the labeling screen to become anchored by accident. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const sid = encodeURIComponent(params.sessionId);
  return callBackend(
    `/v2/coach/sessions/${sid}/confidence-comparison`,
    { method: "GET" },
  );
}
