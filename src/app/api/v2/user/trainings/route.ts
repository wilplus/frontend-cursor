import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/trainings
 *
 * BFF proxy — the training tab's arc-grouped source (R4-13 / BE-B): one entry
 * per arc (deckless included) with its takes, batch_verified and ideal_ready
 * flags. Replaces /user/strengths as the tab's feed. Relayed verbatim.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Trainings service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/user/trainings", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
