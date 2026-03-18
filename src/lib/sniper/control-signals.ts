/**
 * Signed pressure signals for each sniper metric.
 * Each value is in [-1, 1]: positive = over ideal, negative = under ideal.
 * Used by SniperGame (ball target) and BiofeedbackMode (pressure bars).
 */

import type { SniperMetricState } from "./types";
import {
  PACE_IDEAL_WPM,
  PACE_TOLERANCE_WPM,
  PAUSE_IDEAL_MS,
  PAUSE_TOLERANCE_MS,
  DYNAMIC_IDEAL_DB,
  DYNAMIC_TOLERANCE_DB,
  EMPHASIS_IDEAL_PER_MIN,
  EMPHASIS_TOLERANCE,
  PITCH_IDEAL_RANGE_ST,
  PITCH_TOLERANCE_ST,
} from "./constants";

export interface SniperControlSignals {
  /** Positive = too fast, negative = too slow. */
  pace: number;
  /** Positive = too long pauses, negative = too few/short. */
  pause: number;
  /** Positive = too wide dynamic range, negative = too flat. */
  dynamic: number;
  /** Positive = over-emphasis, negative = too monotone. */
  emphasis: number;
  /**
   * Positive = energy building (e3 > e2), negative = energy declining.
   * Zero when energy metric is unavailable (<2 min session).
   */
  energy: number;
  /** Positive = too wide pitch range, negative = too narrow/monotone. */
  pitch: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Compute signed pressure signals from live metric state.
 * All values clamped to [-1, 1].
 */
export function computeControlSignals(
  metrics: SniperMetricState
): SniperControlSignals {
  const e = metrics.energyByThird;
  return {
    pace: clamp(
      (metrics.paceWpm - PACE_IDEAL_WPM) / PACE_TOLERANCE_WPM,
      -1,
      1
    ),
    pause: clamp(
      (metrics.avgPauseMs - PAUSE_IDEAL_MS) / PAUSE_TOLERANCE_MS,
      -1,
      1
    ),
    dynamic: clamp(
      (metrics.dynamicRangeDb - DYNAMIC_IDEAL_DB) / DYNAMIC_TOLERANCE_DB,
      -1,
      1
    ),
    emphasis: clamp(
      (metrics.emphasisPerMin - EMPHASIS_IDEAL_PER_MIN) / EMPHASIS_TOLERANCE,
      -1,
      1
    ),
    energy:
      e && e.e2 > 1e-8
        ? clamp((e.e3 - e.e2) / (e.e2 + 1e-8), -1, 1)
        : 0,
    pitch:
      metrics.pitchRangeSt !== null
        ? clamp(
            (metrics.pitchRangeSt - PITCH_IDEAL_RANGE_ST) / PITCH_TOLERANCE_ST,
            -1,
            1
          )
        : 0,
  };
}
