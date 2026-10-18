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
    // A review's own Ideal Text card counts as the project's card too.
    const reviewCard = message.kind === "walk_step" && message.metadata?.step === "end";
    if (message.kind !== "ideal_text" && !reviewCard) continue;
    const arcId = message.metadata?.arc_id;
    const variant = message.metadata?.variant;
    if (typeof arcId !== "string" || seenArcs.has(arcId)) continue;
    if (typeof variant === "string" && NOT_A_VERSION_BUBBLE.has(variant)) continue;
    seenArcs.add(arcId);
    ids.add(message.client_id);
  }
  return ids;
}

/** ONE IDEAL TEXT BUBBLE PER TAKE (founder 2026-10-14, walk first): a
 *  version bubble whose Take already has its review's card is not drawn.
 *  A Take with no review yet keeps it, drawn as the same small card. */
export function versionBubblesWithReviewCard(
  items: readonly { kind: string; message?: LoungeMessage }[],
): Set<string> {
  const cards = new Set<string>();
  for (const { message } of items) {
    const m = message?.metadata;
    if (message?.kind === "walk_step" && m?.step === "end") cards.add(`${String(m.arc_id)}|${String(m.take_index)}`);
  }
  const hidden = new Set<string>();
  for (const { message } of items) {
    const m = message?.metadata;
    if (message?.kind !== "ideal_text" || !m) continue;
    if (typeof m.variant === "string" && NOT_A_VERSION_BUBBLE.has(m.variant)) continue;
    if (cards.has(`${String(m.arc_id)}|${String(m.version)}`)) hidden.add(message.client_id);
  }
  return hidden;
}

/** ONE BUBBLE PER STEP (founder 2026-10-18, "show only one bubble"): a
 *  walk step shown again from the Lounge can carry a second id (the replay
 *  numbers its moments on its own), so the same bubble lands twice. A later
 *  walk_step that says the same words on the same Take, step, paragraph and
 *  author as an earlier one is not drawn; the first stays. */
export function repeatedWalkStepIds(
  items: readonly { kind: string; message?: LoungeMessage }[],
): Set<string> {
  const seen = new Set<string>();
  const hidden = new Set<string>();
  for (const { kind, message } of items) {
    const m = message?.metadata;
    if (kind !== "message" || message?.kind !== "walk_step" || !m || typeof m.part_id !== "string") continue;
    const id = [String(m.take_session_id), String(m.step), m.part_id, String(m.author), message.body].join("|");
    if (seen.has(id)) hidden.add(message.client_id);
    else seen.add(id);
  }
  return hidden;
}
