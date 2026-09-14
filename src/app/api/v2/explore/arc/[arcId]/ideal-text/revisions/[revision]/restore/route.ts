import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/explore/arc/[arcId]/ideal-text/revisions/[revision]/restore
 *
 * BFF proxy — repoint the composition head at what an earlier revision
 * recorded. Restore never deletes: the answer carries a NEW head revision
 * (restore is itself history, and is itself undoable). Status passthrough:
 * 404 = flag off / not owner / revision unknown → silent refetch FE-side.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Restore service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  _req: NextRequest,
  { params }: { params: { arcId: string; revision: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  const rev = encodeURIComponent(params.revision);
  return callBackend(
    `/v2/explore/arc/${arc}/ideal-text/revisions/${rev}/restore`,
    { method: "POST", failures: FAILURES, relay: RELAY }
  );
}
