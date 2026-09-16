import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/internal/journal/speaking-errors/list
 *
 * BFF passthrough for the speaking error library, read from the CMS.
 *
 * The same library is readable by a signed-in coach at
 * /api/v2/coach/speaking-errors. This one exists because the CMS is gated on
 * the shared admin password in the request BODY and carries no Supabase
 * session, so the coach route's auth cannot serve it. Same table, same rows,
 * different door — matching what the rest of the CMS already does.
 *
 * The CMS needs this to offer the tag picker: an exercise may only claim
 * errors the library calls `detected`, and the picker cannot show that
 * distinction without reading the library.
 *
 * Relays the upstream status verbatim so 401 (wrong password) and 503
 * (password not configured) stay distinguishable. The password is never
 * logged.
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Error library unavailable." } },
};
const RELAY = relayLenient({ bareStatuses: [204, 205, 304] });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return callBackend("/v2/internal/journal/speaking-errors/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token: null,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
