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

/**
 * B4/B5 (reworks U9) — the post-feedback prompt. Fires ONCE per coach-
 * feedback'd session (see wasOfferShown / markOfferShown), at the post-feedback
 * moment (insights-overlay close). The every-visit offer is gone — the bot only
 * offers strong sides / recordings here, never on each visit. The founder's
 * max-2-negatives guardrail is preserved:
 *   - > 2 to_work_on → a warm, low-pressure anchor, NO chips (don't push an
 *                      anxious user straight back on stage after a hard read).
 *   - <= 2           → the "complete picture" offer: strong sides + power
 *                      phrases (B5), recordings (B4), and a go-again chip.
 *   - null           → it wasn't a coach lesson (raw / errored overlay) → none.
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
      text: "Take your time to review these notes. Your coach has highlighted some great anchors for you to sit with. Whenever you're ready for your next session, I'll be right here.",
      chipActions: [],
    };
  }
  return {
    id: `feedback:${sessionId}`,
    text: "Want the complete picture of your strong sides, and the power phrases you can lean on for specific situations? Or go again with this read fresh in mind.",
    chipActions: ["strong_sides", "recordings", "record_again"],
  };
}

/* ─── B4 — never repeat the offer for a session ─────────────────────────── */

const OFFER_KEY_PREFIX = "willab.offer_shown:";

/** Has the post-feedback offer already fired for this session? */
export function wasOfferShown(sessionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OFFER_KEY_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

/** Mark the post-feedback offer shown for this session (best-effort). */
export function markOfferShown(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFER_KEY_PREFIX + sessionId, "1");
  } catch {
    /* swallow — Safari private mode etc. */
  }
}
