import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/recording-progress
 *
 * BFF proxy for C-2 progress-to-first-audit (S2). @require_auth.
 *   200 → { recorded_seconds, threshold_seconds, unlocked }
 *
 * The cumulative seconds the user has recorded vs the 600s audit threshold. The
 * FE renders a progress bar from this and NEVER sums snippet durations (those
 * are selected windows, not total recording time). Until BE-1 ships the upstream
 * route this proxy will relay the backend's 404/501 and the FE hides the bubble.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Progress service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/user/recording-progress", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
