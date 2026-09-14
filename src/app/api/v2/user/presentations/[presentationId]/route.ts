import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * DELETE /api/v2/user/presentations/[presentationId]
 *
 * BFF proxy — deletes a presentation and all its takes from the backend.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHORIZED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Presentations service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { presentationId: string } }
) {
  return callBackend(`/v2/user/presentations/${params.presentationId}`, {
    method: "DELETE",
    failures: FAILURES,
    relay: RELAY,
  });
}
