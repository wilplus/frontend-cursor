import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/sessions/<sessionId>/readout
 *
 * BFF proxy for the Willab durable Readout re-read.
 * Same envelope as the upload 201 — { state, session_context, readout:{snippets} }
 * — but POST-PUBLISH it also carries canonical `feedback_items` plus the
 * separate `coach_review` summary/video layer. @require_auth.
 */
export const GET = proxyRoute("GET", "/v2/user/sessions/:sessionId/readout");
