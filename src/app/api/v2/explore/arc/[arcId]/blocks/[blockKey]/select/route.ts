import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/blocks/[blockKey]/select
 *
 * BFF proxy — pick one variant from the block's pool (mix & match). Status
 * passthrough so the FE can treat 404 (pool changed / flag off) and 409
 * (NOT_PENDING) as a silent picker refetch rather than an error. The write
 * is non-destructive by design: the displaced text goes back to the pool.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Selection service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string; blockKey: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const key = encodeURIComponent(params.blockKey);
  const body = await req.text();
  return callBackend(`/v2/explore/arc/${arc}/blocks/${key}/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
