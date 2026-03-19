/**
 * Live Coach — pure scoring functions.
 * Flow score from pause ratio; pace score from syllable-onset WPM.
 * Performance score = equal blend of both (flow-only until pace warm-up completes).
 */

import type { CoachColor } from "./types";
import {
  FLOW_IDEAL_LO,
  FLOW_IDEAL_HI,
  FLOW_MAX_RATIO,
  FLOW_IDEAL_CENTER,
  FLOW_OFFSET_MAX_DEV,
  PACE_IDEAL_LO,
  PACE_IDEAL_HI,
  PACE_SLOW_MIN,
  PACE_FAST_MAX,
  PACE_IDEAL_CENTER,
  PACE_OFFSET_MAX_DEV,
  COACH_GREEN_THRESHOLD,
  COACH_YELLOW_THRESHOLD,
} from "./constants";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Flow ──────────────────────────────────────────────────────────────────────

/**
 * Flow score 0–100 from pause_ratio.
 * Good band (0.15–0.30) → 100.
 * Too rushed (< 0.15): linear ramp 0 → 100 as ratio goes 0 → 0.15.
 * Too choppy (> 0.30): linear ramp 100 → 0 as ratio goes 0.30 → 0.60.
 */
export function scoreFlow(pauseRatio: number): number {
  if (pauseRatio >= FLOW_IDEAL_LO && pauseRatio <= FLOW_IDEAL_HI) return 100;
  if (pauseRatio < FLOW_IDEAL_LO) {
    return clamp((pauseRatio / FLOW_IDEAL_LO) * 100, 0, 100);
  }
  return clamp(
    ((FLOW_MAX_RATIO - pauseRatio) / (FLOW_MAX_RATIO - FLOW_IDEAL_HI)) * 100,
    0,
    100
  );
}

/**
 * Flow offset –1 to +1 for the sniper ball Y-axis.
 * +1 = too rushed (very few pauses), 0 = balanced, –1 = too choppy (too many pauses).
 */
export function computeFlowOffset(pauseRatio: number): number {
  return clamp((FLOW_IDEAL_CENTER - pauseRatio) / FLOW_OFFSET_MAX_DEV, -1, 1);
}

// ── Pace ──────────────────────────────────────────────────────────────────────

/**
 * Pace score 0–100 from syllable-onset WPM estimate.
 * Good band (125–165 WPM) → 100.
 * Too slow (< 125): linear ramp 0 → 100 as WPM goes PACE_SLOW_MIN → 125.
 * Too fast (> 165): linear ramp 100 → 0 as WPM goes 165 → PACE_FAST_MAX.
 */
export function scorePace(wpm: number): number {
  if (wpm >= PACE_IDEAL_LO && wpm <= PACE_IDEAL_HI) return 100;
  if (wpm < PACE_IDEAL_LO) {
    return clamp(
      ((wpm - PACE_SLOW_MIN) / (PACE_IDEAL_LO - PACE_SLOW_MIN)) * 100,
      0,
      100
    );
  }
  return clamp(
    ((PACE_FAST_MAX - wpm) / (PACE_FAST_MAX - PACE_IDEAL_HI)) * 100,
    0,
    100
  );
}

/**
 * Pace offset –1 to +1 for the sniper ball X-axis.
 * +1 = too fast, 0 = ideal (145 WPM), –1 = too slow.
 */
export function computePaceOffset(wpm: number): number {
  return clamp((wpm - PACE_IDEAL_CENTER) / PACE_OFFSET_MAX_DEV, -1, 1);
}

// ── Combined ──────────────────────────────────────────────────────────────────

/**
 * Performance score = closeness to the ideal (100, 100) corner in score-space.
 *
 * Uses Euclidean distance from perfect so that being bad in one dimension
 * while great in the other scores worse than being mediocre in both.
 * The good band (flowScore=100, paceScore=100) gives score=100.
 *
 * Falls back to flowScore when pace is still warming up (paceScore === null).
 */
export function computePerformanceScore(
  flowScore: number | null,
  paceScore: number | null = null
): number | null {
  if (flowScore === null) return null;
  if (paceScore === null) return flowScore;
  const df = 100 - flowScore;
  const dp = 100 - paceScore;
  const dist = Math.sqrt(df * df + dp * dp);
  const maxDist = Math.SQRT2 * 100; // √2 × 100 when both scores = 0
  return clamp((1 - dist / maxDist) * 100, 0, 100);
}

/** Coach light color from performance score. */
export function getCoachColor(score: number | null): CoachColor {
  if (score === null) return "gray";
  if (score >= COACH_GREEN_THRESHOLD) return "green";
  if (score >= COACH_YELLOW_THRESHOLD) return "yellow";
  return "red";
}
