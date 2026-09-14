import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v2/coach/arc/[arcId]/publish
 *
 * BFF proxy — the arc-level "Publish the full analysis" action. Relays to the
 * BE's publish-analysis (FE-4 — the old /publish path was #186's, deleted in
 * #195; the BE briefly aliased it back while this relay caught up). The BE
 * gates on all takes saved + the ideal text approved and answers 409 with
 * TAKES_NOT_SAVED / IDEAL_TEXT_NOT_APPROVED otherwise; status + body relay
 * verbatim so the FE surfaces the server's own message.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Publish service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  const body = await req.text();
  return callBackend(`/v2/coach/arc/${id}/publish-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    failures: FAILURES,
    relay: RELAY,
  });
}
