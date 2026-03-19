/**
 * Live Coach — coaching cue.
 * Prioritises the worst dimension: pace first if severely off, then flow.
 */

/**
 * Returns a short, actionable coaching cue from current flow + pace state.
 * wpm is null during the pace warm-up window (first ~10 s).
 */
export function getCoachingCue(
  pauseRatio: number,
  silenceGated: boolean,
  wpm: number | null
): string {
  if (silenceGated) return "Speak to start…";

  const flowOk = pauseRatio >= 0.10 && pauseRatio <= 0.35;
  const paceOk = wpm !== null && wpm >= 115 && wpm <= 170;

  // Both good → locked in
  if (flowOk && (wpm === null || paceOk)) return "Locked in. Keep it up.";

  // Pace issues take priority when WPM is available
  if (wpm !== null && !paceOk) {
    if (wpm < 100) return "Way too slow. Pick up the pace.";
    if (wpm < 115) return "A little slow. Speak a touch faster.";
    if (wpm > 190) return "Too fast. Slow down and let ideas land.";
    if (wpm > 170) return "Slightly fast. Ease the pace.";
  }

  // Flow issues
  if (pauseRatio < 0.05) return "No pauses at all. Let your ideas breathe.";
  if (pauseRatio < 0.10) return "Too rushed. Add pauses between ideas.";
  if (pauseRatio > 0.50) return "Too many pauses. Keep the momentum going.";
  return "Slightly choppy. Smooth out the pauses.";
}

/** @deprecated Use getCoachingCue instead. */
export function getFlowCoachingCue(
  pauseRatio: number,
  silenceGated: boolean
): string {
  return getCoachingCue(pauseRatio, silenceGated, null);
}
