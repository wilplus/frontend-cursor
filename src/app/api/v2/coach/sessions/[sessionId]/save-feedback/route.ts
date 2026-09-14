import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/coach/sessions/[sessionId]/save-feedback
 *
 * BFF proxy — the coach's per-take Save checkpoint (delivery layer): persists
 * the take's coach drafts + stamps coach_feedback_saved_at, WITHOUT delivering
 * anything to the user. Body relayed verbatim (same shape as the publish
 * payload). Coach-gated upstream.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Save service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const id = encodeURIComponent(params.sessionId);
  const body = await req.text();
  return callBackend(`/v2/coach/sessions/${id}/save-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
    failures: FAILURES,
    relay: RELAY,
  });
}
