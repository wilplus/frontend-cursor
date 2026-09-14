import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/best-presentation
 *
 * BFF proxy — returns the assembled best-presentation payload for an arc:
 * { ready, progress, slides[], presentation_ref }.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Best-presentation service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/best-presentation`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
