import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/internal/journal/image/delete
 *
 * BFF passthrough for the Journal CMS cover generator: clear a candidate from
 * the strip. The stored file itself stays, so a post still pointing at that URL
 * does not break.
 *
 * Password-gated on the BACKEND (the admin password rides in the body), so this
 * proxy adds no auth of its own and relays the upstream status + body verbatim.
 *
 * The password is never logged.
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Journal service unavailable." } },
};
const RELAY = relayLenient({ bareStatuses: [204, 205, 304] });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return callBackend("/v2/internal/journal/image/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token: null,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
