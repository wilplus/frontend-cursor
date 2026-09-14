import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  /api/v2/coach/training-imports/<sessionId>                                 */
/*                        →  BE /v2/coach/training-imports/<sessionId>         */
/*                                                                            */
/*  GET — the status of ONE import. The POST returns 202 as soon as the upload */
/*  lands and the analysis runs on server-side, so this is how the screen      */
/*  learns whether a 45-minute talk produced pieces, produced nothing, or is   */
/*  still working. Polled every few seconds while a file is in flight.        */
/*                                                                            */
/*  COACH-ONLY data; authorization is enforced upstream                        */
/*  (require_admin_or_coach), so this proxy adds no gate of its own and passes */
/*  401/403 through verbatim.                                                 */
/*                                                                            */
/*  Cheap and short by design — the long-running work is behind the POST, and  */
/*  a status read that hangs would be worse than one that fails and is retried */
/*  on the next tick.                                                         */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Import status unavailable." } },
};
const RELAY = relayLenient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Sign-in is checked before the id, as it always was.
    const token = await getAccessToken();
    if (!token) return failure(FAILURES.unauthenticated!);
    const sessionId = params.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { code: "INVALID_SESSION", error: "No import id." },
        { status: 400 }
      );
    }

    return await callBackend(
      `/v2/coach/training-imports/${encodeURIComponent(sessionId)}`,
      { method: "GET", token, failures: FAILURES, relay: RELAY }
    );
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_training_import_status.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-training-import-status-v1",
      },
      { status: 500 }
    );
  }
}
