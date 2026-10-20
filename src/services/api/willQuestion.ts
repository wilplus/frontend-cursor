import { bffFetch } from "@/lib/api/bffFetch";

/** A tap under Will's one question after a Take (founder 2026-10-20, N82):
 *  one of its answers, or "Skip". The backend writes the tap and the reply
 *  (thanks, or the one follow-up) into the Lounge; the caller reloads the
 *  thread. False on any failure. */
export async function postWillQuestion(
  arcId: string,
  takeSessionId: string,
  choice: string,
): Promise<boolean> {
  try {
    const result = await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/will-question`, {
      method: "POST",
      cache: "no-store",
      json: { take_session_id: takeSessionId, choice },
    });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}
