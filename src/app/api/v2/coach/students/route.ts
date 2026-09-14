import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students
 *
 * BFF proxy for the coach's student roster (E-1 / E3 / §B.4). Pseudonymized
 * upstream — pseudonym + domain (+ last activity, session count), never the
 * user's real name or email. Coach-gated server-side (require_admin_or_coach);
 * a non-coach gets a 403 which the FE soft-fails to an empty roster.
 *
 * E-1a: this proxy route was MISSING — the roster service (E3) called it and got
 * a 404, which is why "My students" rendered empty. This adds the proxy. Pairs
 * with BE-4 (the upstream endpoint + the coach-gate actually returning rows for
 * the signed-in admin).
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Students service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/coach/students", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
