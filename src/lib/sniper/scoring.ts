/**
 * Sniper Wheel — Pure scoring module.
 * Gaussian proximity, caps, bonuses/penalties, tier.
 * All functions are pure and testable.
 */

import type { SniperMetricState, SniperScores, SniperTier } from "./types";
import {
  PACE_IDEAL_WPM,
  PACE_TOLERANCE_WPM,
  PACE_CAP_BELOW,
  PACE_CAP_ABOVE,
  PACE_VARIANCE_BONUS_WPM,
  PAUSE_IDEAL_MS,
  PAUSE_TOLERANCE_MS,
  PAUSE_DENSITY_PENALTY_ABOVE,
  PAUSE_LONG_PAUSE_MS,
  PAUSE_LONG_PAUSE_WINDOW_SEC,
  DYNAMIC_IDEAL_DB,
  DYNAMIC_TOLERANCE_DB,
  DYNAMIC_CAP_SCORE,
  DYNAMIC_RMS_INSTABILITY_DB,
  EMPHASIS_IDEAL_PER_MIN,
  EMPHASIS_TOLERANCE,
  EMPHASIS_CAP_BELOW,
  EMPHASIS_MONOTONE_PENALTY,
  ENERGY_MIN_SESSION_SEC,
  ENERGY_RECOVERY_BONUS,
  ENERGY_DECLINE_PENALTY_RATIO,
  ENERGY_DECLINE_PENALTY,
  ENERGY_BASE_SCORE,
  WEIGHTS,
  TIER_BOUNDS,
} from "./constants";

/** Gaussian-style proximity: score = 100 * exp(-(deviation²) / (2 * tolerance²)). */
function gaussianScore(value: number, ideal: number, tolerance: number): number {
  if (tolerance <= 0) return value === ideal ? 100 : 0;
  const deviation = Math.abs(value - ideal);
  return 100 * Math.exp(-(deviation * deviation) / (2 * tolerance * tolerance));
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, Math.round(s * 10) / 10));
}

/**
 * Pace score: Gaussian around 147 WPM, tolerance 8.
 * Cap at 40 when WPM < 130 or > 165.
 * Optional variance bonus +5 when segment variance ≥ 40 WPM (caller can pass variance).
 */
export function scorePace(
  wpm: number,
  segmentVarianceWpm?: number
): number {
  if (wpm < PACE_CAP_BELOW || wpm > PACE_CAP_ABOVE) {
    return Math.min(40, gaussianScore(wpm, PACE_IDEAL_WPM, PACE_TOLERANCE_WPM));
  }
  let s = gaussianScore(wpm, PACE_IDEAL_WPM, PACE_TOLERANCE_WPM);
  if (
    segmentVarianceWpm != null &&
    segmentVarianceWpm >= PACE_VARIANCE_BONUS_WPM
  ) {
    s = Math.min(100, s + 5);
  }
  return clampScore(s);
}

/**
 * Pause score: Gaussian around 440 ms, tolerance 70.
 * Penalty -10 if speech density > 82%.
 * Penalty -15 if no pause > 1.5 s in last 3 min (caller passes hasLongPauseInWindow).
 */
export function scorePause(
  avgPauseMs: number,
  speechDensity: number,
  hasLongPauseInWindow: boolean
): number {
  let s = gaussianScore(avgPauseMs, PAUSE_IDEAL_MS, PAUSE_TOLERANCE_MS);
  if (speechDensity > PAUSE_DENSITY_PENALTY_ABOVE) s -= 10;
  if (!hasLongPauseInWindow) s -= 15;
  return clampScore(s);
}

/**
 * Dynamic range score: Gaussian around 14 dB, tolerance 2.
 * Cap at 35 when < 9 or > 18. Optional -10 for RMS instability.
 */
export function scoreDynamic(
  dynamicRangeDb: number,
  rmsInstabilityDb?: number
): number {
  if (dynamicRangeDb < 9 || dynamicRangeDb > 18) {
    return Math.min(
      DYNAMIC_CAP_SCORE,
      gaussianScore(dynamicRangeDb, DYNAMIC_IDEAL_DB, DYNAMIC_TOLERANCE_DB)
    );
  }
  let s = gaussianScore(dynamicRangeDb, DYNAMIC_IDEAL_DB, DYNAMIC_TOLERANCE_DB);
  if (
    rmsInstabilityDb != null &&
    rmsInstabilityDb > DYNAMIC_RMS_INSTABILITY_DB
  ) {
    s -= 10;
  }
  return clampScore(s);
}

/**
 * Emphasis score: Gaussian around 35/min, tolerance 8.
 * Cap at 40 when < 15. Optional -5 for monotone (low clustering).
 */
export function scoreEmphasis(
  emphasisPerMin: number,
  monotonePenalty = false
): number {
  if (emphasisPerMin < EMPHASIS_CAP_BELOW) {
    return Math.min(
      40,
      gaussianScore(
        emphasisPerMin,
        EMPHASIS_IDEAL_PER_MIN,
        EMPHASIS_TOLERANCE
      )
    );
  }
  let s = gaussianScore(
    emphasisPerMin,
    EMPHASIS_IDEAL_PER_MIN,
    EMPHASIS_TOLERANCE
  );
  if (monotonePenalty) s -= EMPHASIS_MONOTONE_PENALTY;
  return clampScore(s);
}

/**
 * Energy arc score: relative to session.
 * Base 70 + recovery bonus (E3 ≥ E2) or -decline penalty (E3 < E2 by >15%).
 * Returns 0–100. If session < 2 min or no thirds, returns neutral 70 (no penalty).
 */
export function scoreEnergy(metrics: SniperMetricState): number {
  if (metrics.sessionDurationSec < ENERGY_MIN_SESSION_SEC) {
    return ENERGY_BASE_SCORE;
  }
  const e = metrics.energyByThird;
  if (!e) return ENERGY_BASE_SCORE;

  let s = ENERGY_BASE_SCORE;
  if (e.e3 >= e.e2) {
    s += ENERGY_RECOVERY_BONUS;
  } else if ((e.e2 - e.e3) / (e.e2 + 1e-8) > ENERGY_DECLINE_PENALTY_RATIO) {
    s -= ENERGY_DECLINE_PENALTY;
  }
  return clampScore(s);
}

/**
 * Compute all segment scores from current metrics.
 * Caller provides optional extras: paceVarianceWpm, rmsInstabilityDb, hasLongPauseInWindow, emphasisMonotone.
 */
export function computeScores(
  metrics: SniperMetricState,
  opts: {
    paceVarianceWpm?: number;
    rmsInstabilityDb?: number;
    hasLongPauseInWindow?: boolean;
    emphasisMonotone?: boolean;
  } = {}
): SniperScores {
  const pace = scorePace(metrics.paceWpm, opts.paceVarianceWpm);
  const pause = scorePause(
    metrics.avgPauseMs,
    metrics.speechDensity,
    opts.hasLongPauseInWindow ?? false
  );
  const dynamic = scoreDynamic(
    metrics.dynamicRangeDb,
    opts.rmsInstabilityDb
  );
  const emphasis = scoreEmphasis(
    metrics.emphasisPerMin,
    opts.emphasisMonotone
  );
  const energy = scoreEnergy(metrics);

  return { pace, pause, dynamic, emphasis, energy };
}

/**
 * Weighted overall score 0–100.
 */
export function computeOverallScore(scores: SniperScores): number {
  const raw =
    scores.pace * WEIGHTS.pace +
    scores.pause * WEIGHTS.pause +
    scores.dynamic * WEIGHTS.dynamic +
    scores.emphasis * WEIGHTS.emphasis +
    scores.energy * WEIGHTS.energy;
  return clampScore(raw);
}

/**
 * Resolve tier from overall score. Uses first matching band (92–100, 85–91, …).
 */
export function getTierFromScore(score: number): SniperTier {
  for (const { min, max, tier } of TIER_BOUNDS) {
    if (score >= min && score <= max) return tier;
  }
  return "unstable_delivery";
}
