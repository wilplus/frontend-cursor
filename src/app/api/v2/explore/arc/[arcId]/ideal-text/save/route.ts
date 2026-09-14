import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/ideal-text/save
 *
 * BFF proxy — MASTER DOCUMENT save (accept-and-freeze). Status passthrough so
 * the FE can treat 404 as "the BE hasn't shipped this lane" rather than an
 * error the user has to see.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Ideal-text service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/ideal-text/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    failures: FAILURES,
    relay: RELAY,
  });
}
