import "server-only";
import { NextRequest } from "next/server";
import { callBackend, getAccessToken, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

/**
 * GET /api/v2/explore/arc/[arcId]/progress
 *
 * BFF proxy — cheap progress poll: { takes_done, takes_target, takes_remaining, ready }.
 * Polled by ProgressToAuditBubble for the take counter; the deliverable
 * affordances live on the BE terminal Lounge card (best_presentation_ready /
 * transcript_ready), not here.
 *
 * PUBLIC / guest: a signed-out user may see the progress of the Project owned
 * by their signed Guest ID. The Project UUID alone is never authorization.
 */

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Progress service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const token = await getAccessToken(); // optional — guest-allowed
  const guestOwner = req.headers.get(GUEST_OWNER_HEADER);
  const id = encodeURIComponent(params.arcId);
  const headers: Record<string, string> = {};
  if (!token && guestOwner) headers[GUEST_OWNER_HEADER] = guestOwner;
  return callBackend(`/v2/explore/arc/${id}/progress`, {
    method: "GET",
    headers,
    token,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
