import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/internal/journal/posts/update
 *
 * BFF passthrough for the Journal CMS (full update of one post).
 *
 * Password-gated on the BACKEND: the admin password rides in the request body,
 * exactly like the other internal tools, so this proxy adds no auth of its own
 * and requires no Supabase session. It relays the upstream status + body
 * verbatim so the CMS can show 401 (wrong password) and 503 (password not
 * configured) distinctly.
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
  return callBackend("/v2/internal/journal/posts/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    token: null,
    requireAuth: false,
    failures: FAILURES,
    relay: RELAY,
  });
}
