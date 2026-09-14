import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/v2/coach/sessions/<session_id>
 *
 * BFF proxy for the per-session review payload (§B.2). Verbatim pass-through
 * to `GET /v2/coach/sessions/<id>` on the BE.
 *
 * Authorization is server-enforced via `require_admin_or_coach` upstream.
 * The payload is identity-stripped at the BE — never `name`/`email`, just
 * pseudonym + domain + snippet array with persisted coach_state for resume
 * (E1). The FE never has to filter — it just renders what arrives.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Coach session service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const id = encodeURIComponent(params.sessionId);
    return await callBackend(`/v2/coach/sessions/${id}`, {
      method: "GET",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_session.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-session-v1",
      },
      { status: 500 }
    );
  }
}
