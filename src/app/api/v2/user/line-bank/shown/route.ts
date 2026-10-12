import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/**
 * POST /api/v2/user/line-bank/shown
 *
 * The Feedback walk showed a line of a signed bank (body {"bank"}): it is
 * recorded as said, so the next one differs (build plan D-FW-3; backend
 * 0438). 200 {"bank", "index"}; 400 INVALID_INPUT; 503 V2_ERROR.
 */
export const POST = proxyRoute("POST", "/v2/user/line-bank/shown", { body: "text" });
