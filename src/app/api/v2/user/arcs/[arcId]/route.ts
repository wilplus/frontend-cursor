import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * DELETE /api/v2/user/arcs/[arcId]
 *
 * BFF proxy — permanently deletes one project (arc) and every take in it
 * (the project picker's ⋯ → Delete). Owner-scoped by the backend.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHORIZED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Projects service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  return callBackend(`/v2/user/arcs/${encodeURIComponent(params.arcId)}`, {
    method: "DELETE",
    failures: FAILURES,
    relay: RELAY,
  });
}
