import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/ideal-text/revisions
 *
 * BFF proxy — the composition's revision timeline (newest first, max 50).
 * Verbatim relay: 404 = feature off (render nothing new); an empty list is
 * a real state (pre-migration arc) and hides the timeline entirely.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Revisions service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/ideal-text/revisions`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
