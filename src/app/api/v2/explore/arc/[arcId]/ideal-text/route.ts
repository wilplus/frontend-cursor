import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/ideal-text
 *
 * BFF proxy — the student's paywalled one-block ideal text (delivery layer).
 * 402 until the arc unlock; 404 until the coach approves. Verbatim relay so
 * the FE can treat locked/pending as first-class states.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Ideal-text service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  // FE-3b — ?version=N requests an old version's read-only snapshot.
  const version = req.nextUrl.searchParams.get("version");
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return callBackend(`/v2/explore/arc/${id}/ideal-text${query}`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
