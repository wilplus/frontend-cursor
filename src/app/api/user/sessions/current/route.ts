import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

/**
 * GET /api/user/sessions/current
 *
 * Rich session-state surface for post-auth routing decisions. Proxies
 * to the Python backend's `GET /v2/user/sessions/current`, which inspects
 * the user's most recent v2_sessions row and returns:
 *
 *   {
 *     has_session: boolean,
 *     session_id: string | null,
 *     status: "no_session" | "processing" | "pending_review"
 *           | "completed" | "error",
 *     has_recordings: boolean,
 *     turn_count: number,
 *     snippet_count: number,
 *     published_snippet_count: number,
 *     results_published_at: string | null,
 *     recording_processing_status: string | null,
 *     created_at: string | null
 *   }
 *
 * This is the single source of truth for routing freshly-authenticated
 * users — pick between the recorder, the waiting/founder-video screen,
 * and the snippet-timeline page based on `status` alone.
 *
 * Auth: bearer token (Supabase session). Returns 401 if missing.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Sign-in required." } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL is not configured." } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Session-status service unavailable." } },
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/user/sessions/current", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
