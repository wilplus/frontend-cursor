import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/last-setup
 *
 * BFF proxy for the "Same as last time" prefill — the user's most-recent
 * session's intake_context. @require_auth.
 *   200 { available: true, topic, audience, target_length_seconds,
 *         domain_vocabulary, slides, presentation_ref }
 *   200 { available: false }   // no prior session
 * Omits slide_advances by design (the tap timeline is per-recording).
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Last-setup service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/user/last-setup", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
