/* -------------------------------------------------------------------------- */
/*  THE MOMENT'S OPENING LINE BY HOW CONFIDENT IT WAS (founder 2026-10-14,     */
/*  signed): ten levels, the higher the willfidence the more positive; three   */
/*  lines a level, all three locked, rotated so a speaker does not read the    */
/*  same words twice in a row. The backend sends only the key ("W1".."W10"),   */
/*  never a number (rule 1). Pure.                                             */
/* -------------------------------------------------------------------------- */

export const PRAISE_LEVELS: Record<string, { icon: string; lines: readonly [string, string, string] }> = {
  W1: { icon: "🌱", lines: ["Good, good, keep going.", "Good start, keep going.", "You're on your way. Keep going."] },
  W2: { icon: "🌿", lines: ["Slowly but steadily, you're finding your voice.", "Step by step, you're finding your voice.", "Little by little, your voice is coming through."] },
  W3: { icon: "🙂", lines: ["It's smooth and getting closer to what we want!", "Smooth, and getting closer to where we want to be!", "It flows well and it's getting closer!"] },
  W4: { icon: "👍", lines: ["Good, this one sounds steady.", "Nice and steady.", "Steady and calm. Good."] },
  W5: { icon: "✨", lines: ["There you go. It's your moment.", "There it is. That's your moment.", "That's it. This one is your moment."] },
  W6: { icon: "💪", lines: ["Strong. You sound sure of yourself here.", "Strong. You really mean it here.", "Strong and sure."] },
  W7: { icon: "🔥", lines: ["Wow, great job. This really comes through!", "Wow, great job. That really landed!", "Wow. This really comes through!"] },
  W8: { icon: "🎯", lines: ["Excellent, this is spot on.", "Spot on. Excellent.", "Excellent. Right on target."] },
  W9: { icon: "🚀", lines: ["Outstanding, this is you at your best.", "Outstanding. This is you at your best.", "Outstanding. You're flying here."] },
  W10: { icon: "🏆", lines: ["Wow, that was a Mount Everest delivery!", "That was top-of-Mount-Everest delivery!", "Wow, that was the peak of Mount Everest!"] },
};

/** The moment's opening line for its level, one of three chosen by `seed`
 *  (the moment's id), its icon at the end (founder 2026-10-14); null when
 *  no level was sent. */
export function praiseTitleFor(levelKey: string | null | undefined, seed: string): string | null {
  const level = levelKey ? PRAISE_LEVELS[levelKey] : undefined;
  if (!level) return null;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${level.lines[h % 3].replace(/\.$/, "")} ${level.icon}`;
}
