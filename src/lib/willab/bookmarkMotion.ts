import type { DeckChunk } from "./deckChunks";

/* -------------------------------------------------------------------------- */
/*  WHICH BOOKMARK MOVES (contract 24g, founder 2026-09-20)                    */
/*                                                                            */
/*  On the first bookmarks the product ever showed anyone: "two green          */
/*  bookmarks pulsing and one orange also pulsing — it should not be           */
/*  pulsing."                                                                  */
/*                                                                            */
/*  He was right, and `DeckLockMark` had a comment asserting the opposite:     */
/*  "GREEN NEVER PULSES". That comment was true of `animate-pulse` and false   */
/*  of the screen, because the mark carries TWO animations and only one of     */
/*  them was being counted:                                                    */
/*                                                                            */
/*    animate-pulse         reserved for the exercise tier — correctly gated   */
/*    animate-lock-breathe  the attention ring, scale(1) → scale(1.1) → back,  */
/*                          two seconds, infinite                              */
/*                                                                            */
/*  Nobody looking at a bookmark can tell those apart. `attention` includes    */
/*  `status === "waiting"`, which every undecided bookmark is, so all three    */
/*  marks moved — and the exercise's distinction, the single thing motion was  */
/*  being saved for, was worth nothing.                                        */
/*                                                                            */
/*  THE RING IS NOT THE MOTION. The ring is a static outline meaning "this     */
/*  paragraph is undecided". That predates the tiers, the speaker needs it,    */
/*  and it stays. Only the breathing is withdrawn, and only from tiered marks  */
/*  that are not the exercise. An untiered mark keeps exactly today's          */
/*  behaviour, which is the safe-ahead promise the `tier` prop shipped under.  */
/*                                                                            */
/*  HERE RATHER THAN IN THE COMPONENT, for the reason deckScroll,              */
/*  measureScreenFit and waitProgress each give in turn: vitest cannot         */
/*  transform .tsx, so a rule left inside a component is a rule no unit test   */
/*  can reach — and this is the second time this particular rule has been      */
/*  asserted in a comment while the screen did something else.                 */
/* -------------------------------------------------------------------------- */

export type BookmarkTier = DeckChunk["tier"];

/** Does this mark's attention ring breathe?
 *
 *  Only the exercise moves. An untiered mark (no V3 tier on this paragraph)
 *  keeps the pre-tier behaviour untouched.
 */
export function ringBreathes(tier: BookmarkTier): boolean {
  return !tier || tier === "exercise";
}

/** Does this mark pulse? Only the exercise, which is the one item the speaker
 *  is asked to go and do (24f). */
export function markPulses(tier: BookmarkTier): boolean {
  return tier === "exercise";
}

/** Every animation class this mark may carry, or none.
 *
 *  One place, so "does this bookmark move?" has a single answer rather than
 *  two independent ones that can disagree — which is exactly how green came
 *  to move while a comment said it never would.
 */
export function motionClasses(tier: BookmarkTier, attention: boolean): string {
  return [
    attention && ringBreathes(tier) ? "motion-safe:animate-lock-breathe" : "",
    markPulses(tier) ? "motion-safe:animate-pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** True when this mark is animated at all — the property the founder's
 *  sentence is actually about, and the one worth asserting directly. */
export function marksMove(tier: BookmarkTier, attention: boolean): boolean {
  return motionClasses(tier, attention).length > 0;
}
