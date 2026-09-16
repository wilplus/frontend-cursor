import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET/POST /api/v2/coach/speaking-errors
 *
 * BFF proxy for the speaking error library — the vocabulary exercise matching
 * routes on. Verbatim pass-through to `/v2/coach/speaking-errors`.
 *
 * Authorization is server-enforced upstream by `require_admin_or_coach`. The
 * same table is also writable from the CMS under the shared admin password,
 * which a coach does not have; this is the coach's door, and both call the
 * same service so its refusals hold either way.
 *
 * The upstream status is relayed verbatim because each one means something
 * different to an author and the UI says so:
 *   200 { errors } (GET) · 200 { error } (POST)
 *   400 — the id would match nothing, or a name arrived with no definition
 *   409 ALREADY_DETECTED — this entry is detected in code; saving would
 *        demote it to `observed` and silently stop it routing exercises
 *   403 — caller is not a coach
 *   502 — backend unavailable
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Error library unavailable." } },
};
const RELAY = relayLenient();

export async function GET(_req: NextRequest) {
  return callBackend("/v2/coach/speaking-errors", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return callBackend("/v2/coach/speaking-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    failures: FAILURES,
    relay: RELAY,
  });
}
