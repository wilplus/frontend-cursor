import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/audits
 *
 * BFF proxy for the user's coach-uploaded PDF audits. @require_auth backend-side.
 * Returns { audits:[{ id, name, date, pdf_url }] }, newest first.
 * Empty array when none — never 404.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Audits service unavailable." } },
};
const RELAY = relayStrict({
  code: "UPSTREAM_NON_JSON",
  empty: "object",
  message: (status) => `Unexpected response (HTTP ${status}).`,
});

export async function GET(_req: NextRequest) {
  return callBackend("/v2/user/audits", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
