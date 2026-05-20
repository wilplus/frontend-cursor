import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

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
export async function POST(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const bodyText = await req.text();

    const upstream = await fetch(
      `${backend}/v2/coaching/state-machine/turn`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: bodyText,
        cache: "no-store",
      }
    );

    const text = await upstream.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json(
          {
            code: "UPSTREAM_NON_JSON",
            error: `Unexpected backend response (HTTP ${upstream.status}).`,
          },
          { status: upstream.status >= 400 ? upstream.status : 502 }
        );
      }
    }
    return NextResponse.json(data, { status: upstream.status });
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
