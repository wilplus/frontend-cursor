import type { LoungeMessage } from "@/services/api/loungeMessages";

/* THE UNREAD-FEEDBACK DOT'S HOME (founder 2026-09-25, Q39 B): each project's
   latest Ideal Text bubble. Not the instant card, not a failure card, and not
   the retired "Your coach's feedback is in." bubble. Pure, so the chat gains
   no branch. */

const NOT_A_VERSION_BUBBLE = new Set([
  "instant",
  "ideal_text_unconfirmed",
  "coach_feedback_published",
  "take_processed",
]);

/** The client ids of each project's latest version bubble, given the thread
 *  in display order (oldest first). */
export function latestIdealBubbleIds(
  items: readonly { kind: string; message?: LoungeMessage }[],
): Set<string> {
  const seenArcs = new Set<string>();
  const ids = new Set<string>();
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const message = items[i].message;
    if (items[i].kind !== "message" || !message) continue;
    if (message.kind !== "ideal_text") continue;
    const arcId = message.metadata?.arc_id;
    const variant = message.metadata?.variant;
    if (typeof arcId !== "string" || seenArcs.has(arcId)) continue;
    if (typeof variant === "string" && NOT_A_VERSION_BUBBLE.has(variant)) continue;
    seenArcs.add(arcId);
    ids.add(message.client_id);
  }
  return ids;
}
