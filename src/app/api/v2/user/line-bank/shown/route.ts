import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * POST /api/v2/user/line-bank/shown
 *
 * The Feedback walk showed a line of a signed bank (body {"bank"}): it is
 * recorded as said, so the next one differs (build plan D-FW-3; backend
 * 0438). 200 {"bank", "index"}; 400 INVALID_INPUT; 503 V2_ERROR.
 */
export async function POST(request: NextRequest) {
  return callBackend("/v2/user/line-bank/shown", {
    method: "POST", body: await request.text(), headers: { "Content-Type": "application/json" },
  });
}
