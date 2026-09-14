import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/setup
 *
 * BFF proxy — the project's recording setup (topic / audience / target length /
 * slides / presentation_ref) for context-aware official recording. Owner-only
 * upstream → 404 when not the caller's or the arc has no takes; status
 * passthrough so the FE degrades to a blank setup rather than an error.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Setup service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/setup`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
