/* -------------------------------------------------------------------------- */
/*  loungePrompts — FE-injected conversational bot prompts w/ quick-reply chips */
/*  (U7 / U9)                                                                   */
/*                                                                            */
/*  NOT persisted thread messages — transient, FE-local nudges the Lounge      */
/*  renders at the foot of the thread (same pattern as the U5 sent-confirmation */
/*  bubble), so they're freeze-safe (no BE write). Pure data + a tiny decision  */
/*  fn keep the trigger logic unit-testable.                                    */
/* -------------------------------------------------------------------------- */

export type ChipAction = "strong_sides" | "recordings" | "record_again";

export interface LoungePrompt {
  /** Stable id for dedupe (one per kind / per session). */
  id: string;
  text: string;
  chipActions: ChipAction[];
}

export const CHIP_LABEL: Record<ChipAction, string> = {
  strong_sides: "★ Strong sides",
  recordings: "🕓 Recordings",
  record_again: "Record again",
};

/** U7 — on-visit offer; keeps one-tap access to the two surfaces the (now
 *  deleted) bottom buttons used to provide, as quick-reply chips. */
export const EXPLORE_PROMPT: LoungePrompt = {
  id: "explore",
  text: "Want me to show your strong sides or your recordings? You can always ping me about them.",
  chipActions: ["strong_sides", "recordings"],
};

/**
 * U9 — the post-lesson prompt, with the founder's max-2-negatives guardrail.
 *
 * On closing the insights overlay we count the snippets the coach tagged
 * `to_work_on`. To avoid pushing an anxious user straight back on stage after a
 * heavily-critical read:
 *   - > 2 to_work_on → a warm, low-pressure anchor, NO action chips.
 *   - <= 2           → the "go again with this in mind" nudge + a Record-again chip.
 *   - null           → it wasn't a coach lesson (raw / errored overlay) → no prompt.
 *
 * Purely client-side (counts the already-loaded readout) — freeze-safe.
 */
export function postLessonPrompt(
  sessionId: string,
  toWorkOnCount: number | null
): LoungePrompt | null {
  if (toWorkOnCount === null) return null;
  if (toWorkOnCount > 2) {
    return {
      id: `anchor:${sessionId}`,
      text: "Take your time to review these notes — your coach has highlighted some great anchors for you to sit with. Whenever you're ready for your next session, I'll be right here.",
      chipActions: [],
    };
  }
  return {
    id: `again:${sessionId}`,
    text: "That's your read. The fastest way to grow is to use it — want to go again with one of these in mind?",
    chipActions: ["record_again"],
  };
}
