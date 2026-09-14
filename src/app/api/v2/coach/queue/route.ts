import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/queue
 *
 * BFF proxy for the coach review queue (§B.1). Verbatim pass-through
 * to `GET /v2/coach/queue` on the BE — no FE reshape.
 *
 * Authorization is server-enforced on the BE via `require_admin_or_coach`.
 * Non-coach users get 403 from upstream; the FE service treats that as
 * "no queue to show" and renders nothing. Surface-level FE `is_coach`
 * is render-only — the real boundary lives here on the upstream auth gate.
 *
 * Returns the BE body verbatim (whatever shape it ships):
 *   200 { items: [{ session_id, pseudonym, domain, topic, n_snippets,
 *                   state, sent_at }, ...] }  // expected
 *   401 / 403 — caller is not a coach
 *   404 — endpoint not yet shipped on BE (FE service falls through to [])
 *   502 — backend unavailable
 */
export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coach queue service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(
  _req: NextRequest
) {
  try {
    return await callBackend("/v2/coach/queue", {
      method: "GET",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_queue.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-queue-v1",
      },
      { status: 500 }
    );
  }
}
