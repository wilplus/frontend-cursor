import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/arc/[arcId]/review-state
 *
 * BFF proxy — the coach wrap-up screen's single read (FE-2). Relays
 * `GET /v2/coach/arc/<arcId>/review-state`, which returns per-take review
 * states, the ideal-text assembly/approval status, and `can_publish` +
 * `blockers` (mirroring exactly what publish-analysis enforces) so the wrap-up
 * renders the button's real state instead of discovering it on a failed POST.
 * Coach-gated upstream. Soft-fails to 502 on any transport/parse failure.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Review-state service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/coach/arc/${id}/review-state`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
