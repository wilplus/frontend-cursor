import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * PUT /api/v2/explore/arc/[arcId]/ideal-text/notes
 *
 * BFF proxy — the user's PERSONAL notebook copy of the ideal text (A6). Never
 * touches the coach-approved canonical (L1). Body {text} relayed verbatim.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Notes service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function PUT(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const body = (await req.text()) || "{}";
  return callBackend(`/v2/explore/arc/${id}/ideal-text/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
