import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  The Lounge bubble's "new" (build plan D-FW-19; walk lock 2026-10-06, flow  */
/*  1; backend 0439, services/coach_feedback_signal.py).                       */
/*                                                                            */
/*  The walk tells the server which coach item it showed: the Take's coach    */
/*  note, or one moment. Fire and forget: the walk never waits on it, and a   */
/*  failure only leaves the bubble marked a little longer.                    */
/* -------------------------------------------------------------------------- */

const SEEN = "/api/v2/user/coach-feedback/seen";

/** What one call says was shown: the Take's coach note (no snippet) or a
 *  moment (its snippet id). */
export type CoachFeedbackShown = { takeSessionId: string; snippetId?: string | null };

/** The key a show is remembered by, so one walk says it once. */
export const shownKey = (shown: CoachFeedbackShown): string =>
  `${shown.takeSessionId}:${shown.snippetId ?? "take_word"}`;

/** Shows still on their way, so a re-read of the bubble waits for them. */
const inFlight = new Set<Promise<boolean>>();

/** Every show sent so far has landed (or failed). */
export async function coachFeedbackSeenSettled(): Promise<void> {
  await Promise.allSettled([...inFlight]);
}

export function markCoachFeedbackSeen(shown: CoachFeedbackShown): Promise<boolean> {
  const call = sendSeen(shown);
  inFlight.add(call);
  void call.finally(() => inFlight.delete(call));
  return call;
}

async function sendSeen(shown: CoachFeedbackShown): Promise<boolean> {
  const token = await getAuthToken().catch(() => null);
  if (!token) return false;
  const body: Record<string, string> = { take_session_id: shown.takeSessionId };
  if (shown.snippetId) body.snippet_id = shown.snippetId;
  try {
    const res = await fetch(SEEN, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
