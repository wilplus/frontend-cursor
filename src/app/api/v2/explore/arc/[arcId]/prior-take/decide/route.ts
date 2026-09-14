import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/prior-take/decide
 *
 * BFF proxy — LIVING TRANSCRIPT prior-take decision (accept/keep). Status
 * passthrough (409 STALE_OFFER / NOT_PENDING → silent refetch FE-side).
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Decision service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const body = await req.text();
  return callBackend(`/v2/explore/arc/${arc}/prior-take/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
