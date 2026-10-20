import type { LoungeMessage } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  feedbackCheck — "Did this feedback help you?" in the Lounge (WIL-74,       */
/*  founder 2026-10-19, words signed the same day).                           */
/*                                                                            */
/*  The backend writes the question after the closing summary of a Take       */
/*  (services/feedback_check.py), as an offer bubble: while it is the newest  */
/*  message the footer shows Not really | Yes in place of the record button.  */
/*  A tap goes to the backend, which writes the tap and the signed reply;     */
/*  "Not really" is followed by "What was missing?" with a Skip button, and   */
/*  what the speaker types next is their answer (the chat's own module).      */
/*  Ignored, it stays a bubble; tapping it opens the pair again.              */
/* -------------------------------------------------------------------------- */

export const FEEDBACK_CHECK_LABEL = { yes: "Yes", notReally: "Not really" } as const;

export type FeedbackCheckTarget = { arcId: string; takeSessionId: string };

type Step = "ask" | "missing";

function stepOf(m: Pick<LoungeMessage, "metadata">): Step | null {
  const meta = m.metadata ?? {};
  if (meta.offer === "feedback_check") return "ask";
  return meta.feedback_check === "missing" ? "missing" : null;
}

function targetOf(m: Pick<LoungeMessage, "metadata">): FeedbackCheckTarget | null {
  const { arc_id: arcId, take_session_id: takeSessionId } = m.metadata ?? {};
  return typeof arcId === "string" && typeof takeSessionId === "string"
    ? { arcId, takeSessionId }
    : null;
}

/** The Take the newest question of this step is about (messages oldest
 *  first); null when the thread has none. */
export function feedbackCheckTarget(
  messages: Pick<LoungeMessage, "metadata">[],
  step: Step,
): FeedbackCheckTarget | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (stepOf(messages[i]) === step) return targetOf(messages[i]);
  }
  return null;
}

/** The question is still open while it is the newest message: anything
 *  after it (their tap, a typed turn, a new Take) answers or passes it. */
export function feedbackCheckOpen(messages: Pick<LoungeMessage, "metadata">[]): FeedbackCheckTarget | null {
  const last = messages[messages.length - 1];
  return last && stepOf(last) === "ask" ? targetOf(last) : null;
}
