import type { DeckChunk } from "./deckChunks";

/* -------------------------------------------------------------------------- */
/*  WHAT A BOOKMARK SAYS, AND WITH WHAT (contract 24g, founder 2026-09-20)     */
/*                                                                            */
/*  Two rulings, hours apart, on the first bookmarks the product ever showed.  */
/*                                                                            */
/*  FIRST: "two green bookmarks pulsing and one orange also pulsing — it       */
/*  should not be pulsing." The mark carried TWO animations and only one was   */
/*  gated: `animate-pulse` was reserved for the exercise, while the attention  */
/*  ring's `animate-lock-breathe` ran on every undecided mark. Nobody looking  */
/*  at a bookmark can tell those apart, so all three moved and the exercise's  */
/*  distinction was worth nothing.                                            */
/*                                                                            */
/*  SECOND, and it settled the first: "the ring should not be there because    */
/*  the role of solid bookmark is taken by just black text. There is just      */
/*  fill and motion."                                                         */
/*                                                                            */
/*  He is right, and the deck already proves it. A waiting paragraph renders   */
/*  `text-foreground/55` and a settled one renders `text-foreground` — the     */
/*  whole block dims or goes black. That is the same fact the ring was         */
/*  drawing, said across a paragraph instead of in a two-pixel outline, and    */
/*  the deck's own comment has called the softened block a signal all along.   */
/*  The ring was a third device for a fact already told twice.                */
/*                                                                            */
/*  So the ring goes, and its animation goes with it: `lock-breathe` was the   */
/*  RING breathing, and a ring that does not exist cannot breathe. What is     */
/*  left is what the founder named —                                          */
/*                                                                            */
/*    FILL    solid glyph = an orange rooting phrase is live on this paragraph */
/*    MOTION  the exercise, and nothing else                                   */
/*                                                                            */
/*  — plus colour for the tier and the block's own dim/black for settledness.  */
/*  One device per fact.                                                       */
/*                                                                            */
/*  HERE RATHER THAN IN THE COMPONENT, for the reason deckScroll,              */
/*  measureScreenFit and waitProgress each give in turn: vitest cannot         */
/*  transform .tsx, so a rule left inside a component is a rule no unit test   */
/*  can reach — and this rule has now been asserted in a comment twice while   */
/*  the screen did something else.                                            */
/* -------------------------------------------------------------------------- */

export type BookmarkTier = DeckChunk["tier"];

/** Does this mark move?
 *
 *  Only the exercise, which is the one item the speaker is asked to go and
 *  do (24f). Everything else is still — including an untiered mark, which no
 *  longer breathes because the ring it was breathing around is gone.
 */
export function markPulses(tier: BookmarkTier): boolean {
  return tier === "exercise";
}

/** Every animation class this mark may carry, or none.
 *
 *  One place, so "does this bookmark move?" has a single answer rather than
 *  two independent ones that can disagree — which is exactly how green came
 *  to move while a comment said it never would.
 */
export function motionClasses(tier: BookmarkTier): string {
  return markPulses(tier) ? "motion-safe:animate-pulse" : "";
}

/** True when this mark is animated at all — the property the founder's
 *  sentence is actually about, and the one worth asserting directly. */
export function marksMove(tier: BookmarkTier): boolean {
  return motionClasses(tier).length > 0;
}
