import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const maxDuration = 30;

export const runtime = "nodejs";

/**
 * POST /api/v2/coaching/state-machine/turn
 *
 * BFF proxy for the snippet-review coaching state machine. Forwards
 * the JSON request body to `POST /v2/coaching/state-machine/turn` on
 * the backend, returns the response verbatim (status + body).
 *
 * Backend response shape (informational — kept in sync with
 * src/services/api/stateMachineTurn.ts):
 *   {
 *     step: number,
 *     bot_text?: string,
 *     triggers?: string[],
 *     trial_recording?: { coaching_id: string, prompt_text: string },
 *     // …other per-step fields the state machine emits
 *   }
 *
 * On STEP 9 the response carries `triggers: ["show_trial_recording_mic"]`
 * + a `trial_recording` block; the consumer page renders the
 * TrialRecordingBubble and POSTs the resulting audio to
 * /api/coaching/trial-recording (separate BFF, multipart).
 *
 * Special errors the consumer should handle:
 *   - 409 PRIOR_SESSION_PENDING_REVIEW → render polite decline; do
 *     NOT retry.
 *   - 401 UNAUTHENTICATED → route through the login redirect.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
};
const RELAY = relayStrict({ code: "UPSTREAM_NON_JSON", empty: "object" });

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    return await callBackend("/v2/coaching/state-machine/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
      failures: FAILURES,
      relay: RELAY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/v2/coaching/state-machine/turn error:", name, message, err);
    return NextResponse.json(
      { code: "BFF_THROWN", error: `BFF threw: ${name}: ${message}` },
      { status: 500 }
    );
  }
}
