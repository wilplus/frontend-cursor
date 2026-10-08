import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/user/coach-feedback/seen
 *
 * The Feedback walk showed the speaker a coach item (build plan D-FW-19;
 * backend 0439): the Take's coach note `{take_session_id}` or one moment
 * `{take_session_id, snippet_id}`. Clears the Lounge bubble's "new" for that
 * item until the coach publishes something newer. Verbatim pass-through:
 * 200 {"seen": true}; 400 INVALID_INPUT; 404 NOT_FOUND; 500 V2_ERROR.
 */
export async function POST(request: NextRequest) {
  return callBackend("/v2/user/coach-feedback/seen", {
    method: "POST", body: await request.text(), headers: { "Content-Type": "application/json" },
  });
}
