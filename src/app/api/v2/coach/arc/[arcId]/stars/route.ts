import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  GET /api/v2/coach/arc/[arcId]/stars → BE GET /v2/coach/arc/<arc_id>/stars  */
/*                                                                            */
/*  The coach's star-review list: every machine-fired star on the arc, with    */
/*  any saved verdicts. COACH-ONLY data — authorization is enforced upstream   */
/*  (require_admin_or_coach); the FE `is_coach` flag is render-only, so this   */
/*  proxy adds no gate of its own and passes 401/403/404 through verbatim.     */
/*  Body is relayed untouched: the BFF never reshapes coach payloads.          */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Star review service unavailable." } },
};
const RELAY = relayLenient();

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  try {
    const id = encodeURIComponent(params.arcId);
    return await callBackend(`/v2/coach/arc/${id}/stars`, {
      method: "GET",
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `coach_arc_stars.bff_thrown surface=fe-bff error_name=${name} error_message=${message}`,
      err
    );
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "coach-arc-stars-v1",
      },
      { status: 500 }
    );
  }
}
