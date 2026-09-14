import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/ideal-text/user-edit
 *
 * BFF proxy — persist the STUDENT's edit of their ideal text (#214). Body
 * {text, version}; 200 {saved, version}; 409 {code: "VERSION_SUPERSEDED",
 * current_version} when a newer version assembled mid-edit (the FE retries
 * against it — the student's edit always wins, locked founder rule). Status +
 * body relay verbatim.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Edit service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const body = (await req.text()) || "{}";
  return callBackend(`/v2/explore/arc/${id}/ideal-text/user-edit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
