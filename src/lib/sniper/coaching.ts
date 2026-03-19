/**
 * Live Coach — flow coaching cue.
 * Single actionable message from pause ratio.
 */

/** Returns a short coaching cue based on the current pause ratio. */
export function getFlowCoachingCue(
  pauseRatio: number,
  silenceGated: boolean
): string {
  if (silenceGated) return "Speak to start…";
  if (pauseRatio >= 0.15 && pauseRatio <= 0.30) return "Good flow — hold it.";
  if (pauseRatio < 0.05) return "No pauses at all. Let your ideas breathe.";
  if (pauseRatio < 0.15) return "Too rushed. Add pauses between ideas.";
  if (pauseRatio > 0.45) return "Too many pauses. Keep the momentum going.";
  return "Slightly choppy. Smooth out the pauses.";
}
