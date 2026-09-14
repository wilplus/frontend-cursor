import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/coach/students/<user_id>/audit-data
 *
 * BFF proxy for the coach's student audit data (BE #108). Returns
 * performance_under_feeling and stress_as_fuel analytics for the
 * interactive audit view. Coach/admin-gated server-side; 403 soft-fails
 * to null on the FE.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Audit data service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const uid = encodeURIComponent(params.userId);
  return callBackend(`/v2/coach/students/${uid}/audit-data`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
