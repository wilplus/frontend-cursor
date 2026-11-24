import { reportMomentEvent, type MomentShown } from "@/services/api/momentEvents";

/* -------------------------------------------------------------------------- */
/*  A moment shown in the chat reaches the coach (backend N691 item 1).       */
/*                                                                            */
/*  The coach's queue lists a moment only once the record says it reached     */
/*  the speaker ("opened", backend services/coach_moments_queue.py). The walk */
/*  wrote that record; the feedback now lives in the chat, so the chat's      */
/*  moment bubble writes it when it is shown. Once per moment on this page;   */
/*  the server keeps one row per moment, so a reload only repeats a no-op.    */
/*  Existence only: nothing the speaker said travels (BLIND COACH).           */
/* -------------------------------------------------------------------------- */

const told = new Set<string>();

/** What a chat bubble showed with its moment, kept to the known kinds. */
export function shownInChat(bubble: { exercise: boolean; coachVideo: boolean }): MomentShown[] {
  const shown: MomentShown[] = [];
  if (bubble.exercise) shown.push("exercise");
  if (bubble.coachVideo) shown.push("coach_answer");
  return shown;
}

/** Record once that this moment reached the speaker in the chat. */
export function noteMomentReached(snippetId: string | null | undefined, shown: readonly MomentShown[] = []): void {
  if (!snippetId || told.has(snippetId)) return;
  told.add(snippetId);
  // A failed call lets the next showing try again.
  void reportMomentEvent(snippetId, "opened", shown)
    .then((outcome) => { if (outcome.kind === "failed") told.delete(snippetId); })
    .catch(() => told.delete(snippetId));
}

/** Tests only. */
export function forgetMomentsReached(): void {
  told.clear();
}
