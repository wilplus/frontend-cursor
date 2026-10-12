import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/**
 * GET /api/v2/user/readouts
 *
 * BFF proxy for the willab Readout history / status list (§6a). @require_auth.
 *   200 → { readouts: [ { session_id, created_at, topic, state } ], count }
 * Newest first. Used to reconcile the at-home status (review_pending /
 * insights) with server truth on load.
 */
export const GET = proxyRoute("GET", "/v2/user/readouts");
