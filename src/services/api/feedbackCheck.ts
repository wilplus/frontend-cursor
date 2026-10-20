import { bffFetch } from "@/lib/api/bffFetch";

/** A tap on "Did this feedback help you?" (WIL-74, founder 2026-10-19):
 *  Yes, Not really, or Skip under "What was missing?". The backend writes the
 *  tap and the signed reply into the Lounge; the caller reloads the thread.
 *  False on any failure. */
export type FeedbackCheckChoice = "yes" | "not_really" | "skip";

export async function postFeedbackCheck(
  arcId: string,
  takeSessionId: string,
  choice: FeedbackCheckChoice,
): Promise<boolean> {
  try {
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/feedback-check`, {
      method: "POST",
      cache: "no-store",
      json: { take_session_id: takeSessionId, choice },
    });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}
