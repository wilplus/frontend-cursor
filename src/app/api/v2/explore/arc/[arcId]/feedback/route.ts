import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/feedback
 *
 * BFF proxy — the per-take feedback packet (delivery layer). Take 1 is free;
 * takes 2/3 arrive locked (no content) until the arc's $25 unlock. Authed —
 * feedback is a published deliverable on the user's own arc.
 *
 * Verbatim status + JSON pass-through.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Feedback service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/feedback`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
