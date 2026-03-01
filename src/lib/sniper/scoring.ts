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
  PACE_SOFT_FLOOR,
  PACE_CATASTROPHIC_LO,
  PACE_CATASTROPHIC_HI,
  PAUSE_IDEAL_MS,
  PAUSE_TOLERANCE_MS,
  PAUSE_DENSITY_PENALTY_ABOVE,
  PAUSE_LONG_PAUSE_MS,
  PAUSE_LONG_PAUSE_WINDOW_SEC,
  PAUSE_SOFT_FLOOR,
  DYNAMIC_IDEAL_DB,
  DYNAMIC_TOLERANCE_DB,
  DYNAMIC_CAP_SCORE,
  DYNAMIC_RMS_INSTABILITY_DB,
  DYNAMIC_SOFT_FLOOR,
  DYNAMIC_CATASTROPHIC_LO,
  EMPHASIS_IDEAL_PER_MIN,
  EMPHASIS_TOLERANCE,
  EMPHASIS_CAP_BELOW,
  EMPHASIS_MONOTONE_PENALTY,
  EMPHASIS_SOFT_FLOOR,
  EMPHASIS_CATASTROPHIC_LO,
  ENERGY_MIN_SESSION_SEC,
  ENERGY_RECOVERY_BONUS,
  ENERGY_DECLINE_PENALTY_RATIO,
  ENERGY_DECLINE_PENALTY,
  ENERGY_BASE_SCORE,
  WEIGHTS,
  WEIGHTS_WITHOUT_ENERGY,
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

/** Soft floor: score = floor + (100 - floor) * (raw/100). Gaussian preserved; nobody below floor unless catastrophic. */
function applySoftFloor(raw: number, floor: number): number {
  const g = Math.max(0, Math.min(1, raw / 100));
  return clampScore(floor + (100 - floor) * g);
}

/** Catastrophic zone: bypass soft floor; allow score to sit in 30–40. */
const CATASTROPHIC_SCORE_LO = 30;
const CATASTROPHIC_SCORE_HI = 40;
function clampCatastrophic(raw: number): number {
  return clampScore(Math.max(CATASTROPHIC_SCORE_LO, Math.min(CATASTROPHIC_SCORE_HI, raw)));
}

/**
 * Pace score: Gaussian around 147 WPM, tolerance 8.
 * Cap at 40 when WPM < 130 or > 165.
 * Soft floor 55 unless catastrophic (WPM < 110 or > 190 → score 30–40).
 */
export function scorePace(
  wpm: number,
  segmentVarianceWpm?: number
): number {
  let raw: number;
  if (wpm < PACE_CAP_BELOW || wpm > PACE_CAP_ABOVE) {
    raw = Math.min(40, gaussianScore(wpm, PACE_IDEAL_WPM, PACE_TOLERANCE_WPM));
  } else {
    raw = gaussianScore(wpm, PACE_IDEAL_WPM, PACE_TOLERANCE_WPM);
    if (
      segmentVarianceWpm != null &&
      segmentVarianceWpm >= PACE_VARIANCE_BONUS_WPM
    ) {
      raw = Math.min(100, raw + 5);
    }
  }
  if (wpm < PACE_CATASTROPHIC_LO || wpm > PACE_CATASTROPHIC_HI) {
    return clampCatastrophic(raw);
  }
  return applySoftFloor(raw, PACE_SOFT_FLOOR);
}

/**
 * Pause score: Gaussian around 440 ms, tolerance 70.
 * Penalty -10 if speech density > 82%.
 * Penalty -15 if no pause > 1.5 s in last 3 min (caller passes hasLongPauseInWindow).
 * Soft floor 55.
 */
export function scorePause(
  avgPauseMs: number,
  speechDensity: number,
  hasLongPauseInWindow: boolean
): number {
  let raw = gaussianScore(avgPauseMs, PAUSE_IDEAL_MS, PAUSE_TOLERANCE_MS);
  if (speechDensity > PAUSE_DENSITY_PENALTY_ABOVE) raw -= 10;
  if (!hasLongPauseInWindow) raw -= 15;
  raw = Math.max(0, raw);
  return applySoftFloor(raw, PAUSE_SOFT_FLOOR);
}

/**
 * Dynamic range score: Gaussian around 14 dB, tolerance 2.
 * Cap at 35 when < 9 or > 18. Optional -10 for RMS instability.
 * Soft floor 60 unless catastrophic (< 6 dB → score 30–40).
 */
export function scoreDynamic(
  dynamicRangeDb: number,
  rmsInstabilityDb?: number
): number {
  let raw: number;
  if (dynamicRangeDb < 9 || dynamicRangeDb > 18) {
    raw = Math.min(
      DYNAMIC_CAP_SCORE,
      gaussianScore(dynamicRangeDb, DYNAMIC_IDEAL_DB, DYNAMIC_TOLERANCE_DB)
    );
  } else {
    raw = gaussianScore(dynamicRangeDb, DYNAMIC_IDEAL_DB, DYNAMIC_TOLERANCE_DB);
    if (
      rmsInstabilityDb != null &&
      rmsInstabilityDb > DYNAMIC_RMS_INSTABILITY_DB
    ) {
      raw -= 10;
    }
  }
  raw = Math.max(0, raw);
  if (dynamicRangeDb < DYNAMIC_CATASTROPHIC_LO) {
    return clampCatastrophic(raw);
  }
  return applySoftFloor(raw, DYNAMIC_SOFT_FLOOR);
}

/**
 * Emphasis score: Gaussian around 35/min, tolerance 8.
 * Cap at 40 when < 15. Optional -5 for monotone (low clustering).
 * Soft floor 60 unless catastrophic (< 8/min → score 30–40).
 */
export function scoreEmphasis(
  emphasisPerMin: number,
  monotonePenalty = false
): number {
  let raw: number;
  if (emphasisPerMin < EMPHASIS_CAP_BELOW) {
    raw = Math.min(
      40,
      gaussianScore(
        emphasisPerMin,
        EMPHASIS_IDEAL_PER_MIN,
        EMPHASIS_TOLERANCE
      )
    );
  } else {
    raw = gaussianScore(
      emphasisPerMin,
      EMPHASIS_IDEAL_PER_MIN,
      EMPHASIS_TOLERANCE
    );
    if (monotonePenalty) raw -= EMPHASIS_MONOTONE_PENALTY;
  }
  raw = Math.max(0, raw);
  if (emphasisPerMin < EMPHASIS_CATASTROPHIC_LO) {
    return clampCatastrophic(raw);
  }
  return applySoftFloor(raw, EMPHASIS_SOFT_FLOOR);
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
 * When energyAvailable is false (session <2 min), energy is excluded and the other four metrics are reweighted to sum to 1.
 */
export function computeOverallScore(
  scores: SniperScores,
  energyAvailable = true
): number {
  if (energyAvailable) {
    const raw =
      scores.pace * WEIGHTS.pace +
      scores.pause * WEIGHTS.pause +
      scores.dynamic * WEIGHTS.dynamic +
      scores.emphasis * WEIGHTS.emphasis +
      scores.energy * WEIGHTS.energy;
    return clampScore(raw);
  }
  const raw =
    scores.pace * WEIGHTS_WITHOUT_ENERGY.pace +
    scores.pause * WEIGHTS_WITHOUT_ENERGY.pause +
    scores.dynamic * WEIGHTS_WITHOUT_ENERGY.dynamic +
    scores.emphasis * WEIGHTS_WITHOUT_ENERGY.emphasis;
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
