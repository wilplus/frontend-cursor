import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/blocks/[blockKey]/decide
 *
 * BFF proxy — MASTER DOCUMENT block-upgrade decision (accept/keep). Status
 * passthrough so the FE can treat 409 (STALE_OFFER / NOT_PENDING) as a
 * silent refetch rather than an error.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Decision service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; blockKey: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const key = encodeURIComponent(params.blockKey);
  const body = await req.text();
  return callBackend(`/v2/explore/arc/${arc}/blocks/${key}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
