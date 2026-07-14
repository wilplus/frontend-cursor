/* -------------------------------------------------------------------------- */
/*  primingPhrases — the pre-take mindset-priming panel copy (R5)              */
/*                                                                            */
/*  Founder-authored framing shown on the one-layer panel BEFORE each take,   */
/*  as the threat / challenge / balanced manipulation, one condition per batch */
/*  position (take 1 = threat, take 2 = challenge, take 3 = balanced). One      */
/*  phrase is picked at random from the take's bank so repeated takes don't     */
/*  always show the same line.                                                 */
/*                                                                            */
/*  NOTE (AC-9): the "score / graded / criticized" language is deliberate      */
/*  priming, NOT a surfaced analysis score. AC-9 governs real derived metrics;  */
/*  this is experimental framing copy, founder-authored (LIVE-LOOP sign-off).   */
/*  The chosen condition + phrase is logged per take (BE) so the framing can be */
/*  correlated with the acoustic read.                                         */
/* -------------------------------------------------------------------------- */

export type PrimingCondition = "threat" | "challenge" | "balanced";

const PHRASES: Record<PrimingCondition, readonly string[]> = {
  // Take 1 — threat framing (focus on failure and judgment).
  threat: [
    "Your performance is being strictly graded; errors will lower your score.",
    "This recording will expose any weaknesses in your speaking skills.",
    "Do not mess up; mistakes will be permanently logged.",
  ],
  // Take 2 — challenge framing (focus on growth and effort).
  challenge: [
    "This is a tough test to help you sharpen your skills.",
    "See this as an exciting chance to show your progress.",
    "Your racing heart is just energy to help you focus.",
  ],
  // Take 3 — balanced framing (high stakes mixed with encouragement).
  balanced: [
    "The standards are very high, but you have the tools to meet them.",
    "This will be heavily criticized, so use that pressure to push through.",
    "A poor score carries real consequences, but this is your chance to adapt.",
  ],
};

/** The batch position (1/2/3) → its framing condition. Anything outside 1..3
 *  (a re-parented/over-long arc) falls back to the balanced set. */
export function primingConditionForTake(batchTake: number): PrimingCondition {
  if (batchTake <= 1) return "threat";
  if (batchTake === 2) return "challenge";
  return "balanced";
}

/** Pick one random phrase from the take's condition bank. `rand` is injectable
 *  for deterministic tests. */
export function pickPrimingPhrase(
  batchTake: number,
  rand: () => number = Math.random
): { condition: PrimingCondition; phrase: string } {
  const condition = primingConditionForTake(batchTake);
  const bank = PHRASES[condition];
  const i = Math.min(bank.length - 1, Math.max(0, Math.floor(rand() * bank.length)));
  return { condition, phrase: bank[i] ?? bank[0] };
}
