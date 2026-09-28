import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/learning-exposures/ack
 *   → BE POST /v2/learning-exposures/ack
 *
 * The exposure receipt (G-1, audit 2026-09-22). The browser confirms that a
 * prepared learning packet actually rendered for this actor; the backend
 * turns that into an immutable receipt, which is the only thing that lets
 * the seven-surface readiness leave "blocked". The client
 * (`src/services/api/learningExposures.ts`) has posted here since the
 * backend route shipped; this file is the leg that was never written, so
 * every acknowledgement 404ed and no receipt was ever recorded.
 *
 *   POST { presentation_id, acknowledgement_token, actor_role,
 *          render_instance_id, client_rendered_at }
 *        200 { acknowledged, exposure_receipt_id, learning_surface, replayed }
 *        400 INVALID_INPUT · 404 NOT_FOUND · 409 EXPOSURE_ACK_REJECTED
 *
 * Verbatim pass-through of ids and timestamps; nothing here carries a score,
 * a prediction or any text. @require_auth backend-side; the backend also
 * refuses a coach acknowledgement from a non-coach.
 */
const UPSTREAM = "/v2/learning-exposures/ack";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Learning service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest) {
  const body = await req.text();
  return callBackend(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
    failures: FAILURES,
    relay: RELAY,
  });
}
