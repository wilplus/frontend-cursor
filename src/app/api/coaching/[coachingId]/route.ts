import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/coaching/[coachingId]
 *
 * Re-hydrate a coaching session so /coach/[id] survives reloads.
 * Proxies to `GET /v2/coaching/<id>`.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Sign-in required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coaching service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { coachingId: string } }
) {
  const id = encodeURIComponent(params.coachingId);
  return callBackend(`/v2/coaching/${id}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
