import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET / POST / DELETE /api/v2/user/lounge/messages
 *
 * BFF proxy for the willab-beta Lounge persistence store (`lounge_messages`,
 * BE shipped). Verbatim pass-through so the backend's envelopes reach the
 * FE glue unchanged. @require_auth backend-side.
 *
 *   GET  ?limit=50&before=<iso8601>
 *        200 { messages:[{id,client_id,role,kind,body,metadata,client_created_at}],
 *              has_more, oldest_cursor }   // ASC by client_created_at
 *        400 INVALID_INPUT on malformed `before`; soft-fails to an empty page
 *
 *   POST { messages:[{client_id,role,kind,body,metadata?,client_created_at}] }
 *        200 { messages:[...persisted rows w/ server id] }
 *        idempotent on (user_id, client_id); batch ceiling 200 → 422 if exceeded
 *
 *   DELETE  204  // clears the whole thread (§3.14 user-deletable)
 *
 * Text-only, never audio, never the coach packet, never profiled.
 */
const UPSTREAM = "/v2/user/lounge/messages";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Lounge service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });
// A 204 (the thread is cleared) must not carry a body.
const DELETE_RELAY = relayStrict({
  code: "UPSTREAM_NON_JSON",
  empty: "object",
  bareStatuses: [204],
});

export async function GET(req: NextRequest) {
  const search = new URLSearchParams();
  const limit = req.nextUrl.searchParams.get("limit");
  const before = req.nextUrl.searchParams.get("before");
  if (limit) search.set("limit", limit);
  if (before) search.set("before", before);
  const qs = search.toString();
  return callBackend(`${UPSTREAM}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return callBackend(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
    failures: FAILURES,
    relay: RELAY,
  });
}

export async function DELETE(_req: NextRequest) {
  return callBackend(UPSTREAM, {
    method: "DELETE",
    failures: FAILURES,
    relay: DELETE_RELAY,
  });
}
