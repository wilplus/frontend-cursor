/**
 * Typed client for the coaching state-machine turn endpoint.
 *
 *   POST /api/v2/coaching/state-machine/turn  (BFF)
 *      → POST /v2/coaching/state-machine/turn (backend)
 *
 * Drives the snippet-review chat surface. Each turn the backend
 * returns a step number plus optional bot copy, trigger flags, and
 * step-specific data blobs (e.g. STEP 9's trial_recording payload).
 *
 * The response shape is intentionally permissive (all per-step fields
 * optional) — the consumer pattern-matches on `step` + `triggers`
 * rather than relying on field presence. This keeps the type stable
 * as the backend adds more steps without breaking older consumers.
 */

/** STEP 9 payload — the snippet re-recording invitation. */
export interface TrialRecordingPayload {
  /** Coaching session id to send back with the audio upload. */
  coaching_id: string;
  /** AI-generated copy shown above the record button — what the user
   *  should attempt to re-perform in their voice. */
  prompt_text: string;
}

/**
 * Trigger flags emitted by the state machine. Unknown values are
 * tolerated — consumers should switch on the strings they recognise
 * and ignore the rest so a backend rollout that adds new triggers
 * doesn't break older frontends.
 */
export type StateMachineTrigger =
  | "show_trial_recording_mic"
  | (string & {});

export interface StateMachineTurnResponse {
  /** Current step in the snippet-review state machine (1-indexed). */
  step?: number;
  /** Bot bubble copy for this turn (when the step has one). */
  bot_text?: string;
  /** Optional per-step trigger flags. STEP 9 emits
   *  "show_trial_recording_mic" alongside `trial_recording`. */
  triggers?: StateMachineTrigger[];
  /** Present on STEP 9. Consumers render the TrialRecordingBubble. */
  trial_recording?: TrialRecordingPayload | null;
  /** Generic error envelope echoed by the BFF on non-2xx. */
  error?: string;
  code?: string;
}

export interface StateMachineTurnArgs {
  /** Server-tracked coaching session id (snippet review thread). */
  coaching_id: string;
  /** Optional payload depending on the step the user is responding
   *  to — text answers, label picks, etc. Backend defines the shape;
   *  the frontend just forwards. */
  payload?: Record<string, unknown>;
}

const ENDPOINT = "/api/v2/coaching/state-machine/turn";

export async function postStateMachineTurn(
  args: StateMachineTurnArgs
): Promise<StateMachineTurnResponse> {
  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
  let data: unknown = {};
  try {
    data = await resp.json();
  } catch {
    return {
      error: `Unexpected backend response (HTTP ${resp.status}).`,
      code: "INVALID_RESPONSE",
    };
  }
  return data as StateMachineTurnResponse;
}
