/**
 * Live Coach — pure scoring functions.
 * Flow score from pause ratio; performance score = flow score (no live WPM yet).
 */

import type { CoachColor } from "./types";
import {
  FLOW_IDEAL_LO,
  FLOW_IDEAL_HI,
  FLOW_MAX_RATIO,
  FLOW_IDEAL_CENTER,
  FLOW_OFFSET_MAX_DEV,
  COACH_GREEN_THRESHOLD,
  COACH_YELLOW_THRESHOLD,
} from "./constants";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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
 * +1 = too rushed (very few pauses), 0 = balanced, –1 = too many pauses.
 */
export function computeFlowOffset(pauseRatio: number): number {
  return clamp((FLOW_IDEAL_CENTER - pauseRatio) / FLOW_OFFSET_MAX_DEV, -1, 1);
}

/** Performance score = flow score (no live WPM yet). */
export function computePerformanceScore(flowScore: number | null): number | null {
  return flowScore;
}

/** Coach light color from performance score. */
export function getCoachColor(score: number | null): CoachColor {
  if (score === null) return "gray";
  if (score >= COACH_GREEN_THRESHOLD) return "green";
  if (score >= COACH_YELLOW_THRESHOLD) return "yellow";
  return "red";
}
