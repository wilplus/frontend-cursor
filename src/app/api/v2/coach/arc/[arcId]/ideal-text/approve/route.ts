import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/arc/[arcId]/ideal-text/approve
 *
 * BFF proxy — the coach approves the one-block ideal text (sets approved_at),
 * which the final "Save and Publish full analysis" requires. Coach-gated
 * upstream.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Approve service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/coach/arc/${id}/ideal-text/approve`, {
    method: "POST",
    failures: FAILURES,
    relay: RELAY,
  });
}
