import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/chat/session-state
 *
 * BFF proxy for the BE-owned chat session state (seam 8).
 * @optional_auth — never 401s; anonymous users receive NO_SESSION.
 * Response: { state: "NO_SESSION" | "PENDING_COACH" | "REVIEW_LOOP" }
 *
 * The FE drives the active Lounge mode off this value:
 *   NO_SESSION    → lounge_idle  (no pending session)
 *   PENDING_COACH → review_pending (sent; awaiting coach)
 *   REVIEW_LOOP   → insights_ready (coach published; unread)
 */

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Session-state service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest) {
  // @optional_auth upstream — the token is forwarded when present, never
  // demanded (requireAuth: false).
  return callBackend("/v2/chat/session-state", {
    method: "GET",
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
