import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/sessions/<sessionId>/readout
 *
 * BFF proxy for the willab Readout re-read (§3.0 park/re-read, §6 insights).
 * Same envelope as the upload 201 — { state, session_context, readout:{snippets} }
 * — but POST-PUBLISH it also carries each snippet's `coach{note,tag}` and
 * `readout.insights_payload.overall_message` (the user lane). @require_auth.
 * Reading it is also what triggers the BE's library ingest (§3.11).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const id = encodeURIComponent(params.sessionId);
  return callBackend(`/v2/user/sessions/${id}/readout`, { method: "GET" });
}
