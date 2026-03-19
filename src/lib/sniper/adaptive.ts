/**
 * Live Coach — adaptive layer (MVP stub).
 * No growth tracking in v1 — displayScore = performanceScore directly.
 * Baseline and growth will be added in v2 once WPM is wired.
 */

/** MVP: returns performanceScore as displayScore with no baseline blending. */
export function computeAdaptiveResult(
  performanceScore: number
): { displayScore: number; baselineReady: false; sessionCount: 0 } {
  return { displayScore: performanceScore, baselineReady: false, sessionCount: 0 };
}
