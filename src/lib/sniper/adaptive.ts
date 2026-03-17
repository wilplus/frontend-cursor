/**
 * Sniper Adaptive Layer — growth score and stage+growth blend.
 * Pure functions; no DB. Baseline comes from API; growth measures "closer to ideal than baseline".
 */

import type { UserSniperProfile, SniperSessionMeans } from "./types";
import type { SniperGrowthResult } from "./types";
import {
  PACE_IDEAL_WPM,
  PAUSE_IDEAL_MS,
  DYNAMIC_IDEAL_DB,
  EMPHASIS_IDEAL_PER_MIN,
  PITCH_IDEAL_RANGE_ST,
  WEIGHTS,
  BLEND_STAGE_WEIGHT,
  BLEND_GROWTH_WEIGHT,
  MIN_SESSIONS_FOR_BASELINE,
} from "./constants";

const EPS = 1e-6;

/** Improvement ratio: 1 - (current_distance / max(baseline_distance, eps)). Clamped [0, 1]. */
function improvementRatio(
  baseline: number,
  current: number,
  ideal: number
): number {
  const baselineDist = Math.abs(baseline - ideal);
  const currentDist = Math.abs(current - ideal);
  const denom = Math.max(baselineDist, EPS);
  const ratio = 1 - currentDist / denom;
  return Math.max(0, Math.min(1, ratio));
}

/** Energy: ideal is E3/E2 >= 1. Improvement = 1 - |current_ratio - 1| / max(|baseline_ratio - 1|, eps). */
function improvementEnergy(baselineRatio: number, currentRatio: number): number {
  const baselineGap = Math.abs(baselineRatio - 1);
  const currentGap = Math.abs(currentRatio - 1);
  const denom = Math.max(baselineGap, EPS);
  const ratio = 1 - currentGap / denom;
  return Math.max(0, Math.min(1, ratio));
}

/** True when all required baselines are set (so we can compute growth). */
function hasRequiredBaselines(profile: UserSniperProfile, energyAvailable: boolean): boolean {
  if (
    profile.baseline_wpm == null ||
    profile.baseline_pause_ms == null ||
    profile.baseline_dynamic_db == null ||
    profile.baseline_emphasis_per_min == null
  ) {
    return false;
  }
  if (energyAvailable && profile.baseline_energy_ratio == null) return false;
  return true;
}

/**
 * Compute growth score 0–100 from baseline vs current session means.
 * Uses same weights as stage scoring. Each metric contributes only when both a baseline
 * and a session value exist — the sum of active weights is used to normalize, so the
 * score always sits in [0, 100] regardless of which optional metrics are available.
 * Returns 0 when required core baselines (pace, pause, dynamic, emphasis) are null.
 */
export function computeGrowthScore(
  profile: UserSniperProfile,
  sessionMeans: SniperSessionMeans,
  energyAvailable: boolean
): number {
  if (!hasRequiredBaselines(profile, energyAvailable)) return 0;

  let raw = 0;
  let totalWeight = 0;

  // Core metrics (always present when baselines are ready)
  const impPace = improvementRatio(profile.baseline_wpm!, sessionMeans.paceWpm, PACE_IDEAL_WPM);
  raw += WEIGHTS.pace * impPace; totalWeight += WEIGHTS.pace;

  const impPause = improvementRatio(profile.baseline_pause_ms!, sessionMeans.avgPauseMs, PAUSE_IDEAL_MS);
  raw += WEIGHTS.pause * impPause; totalWeight += WEIGHTS.pause;

  const impDynamic = improvementRatio(profile.baseline_dynamic_db!, sessionMeans.dynamicRangeDb, DYNAMIC_IDEAL_DB);
  raw += WEIGHTS.dynamic * impDynamic; totalWeight += WEIGHTS.dynamic;

  const impEmphasis = improvementRatio(profile.baseline_emphasis_per_min!, sessionMeans.emphasisPerMin, EMPHASIS_IDEAL_PER_MIN);
  raw += WEIGHTS.emphasis * impEmphasis; totalWeight += WEIGHTS.emphasis;

  // Energy (optional — requires 2+ min session and an energy baseline)
  if (energyAvailable && sessionMeans.energyRatio != null && profile.baseline_energy_ratio != null) {
    const impEnergy = improvementEnergy(profile.baseline_energy_ratio, sessionMeans.energyRatio);
    raw += WEIGHTS.energy * impEnergy; totalWeight += WEIGHTS.energy;
  }

  // Pitch (optional — requires pitch baseline from a prior session)
  if (sessionMeans.pitchRangeSt != null && profile.baseline_pitch_range_st != null) {
    const impPitch = improvementRatio(profile.baseline_pitch_range_st, sessionMeans.pitchRangeSt, PITCH_IDEAL_RANGE_ST);
    raw += WEIGHTS.pitch * impPitch; totalWeight += WEIGHTS.pitch;
  }

  // Normalize by sum of active weights so the score is always 0–100.
  const normalizedRaw = totalWeight > EPS ? raw / totalWeight : 0;
  return Math.round(Math.max(0, Math.min(100, normalizedRaw * 100)) * 10) / 10;
}

/** Blend: display_score = BLEND_STAGE_WEIGHT * stage + BLEND_GROWTH_WEIGHT * growth. */
export function blendDisplayScore(
  stageScore: number,
  growthScore: number
): number {
  return Math.round(
    (BLEND_STAGE_WEIGHT * stageScore + BLEND_GROWTH_WEIGHT * growthScore) * 10
  ) / 10;
}

/** Baseline is "ready" when session_count >= MIN_SESSIONS_FOR_BASELINE. */
export function isBaselineReady(profile: UserSniperProfile | null): boolean {
  return profile != null && profile.session_count >= MIN_SESSIONS_FOR_BASELINE;
}

/**
 * Full adaptive result: growth score, blended display score, and whether to show "Progress".
 */
export function computeAdaptiveResult(
  profile: UserSniperProfile | null,
  stageScore: number,
  sessionMeans: SniperSessionMeans,
  energyAvailable: boolean
): SniperGrowthResult {
  const baselineReady = isBaselineReady(profile);
  if (!baselineReady || !profile) {
    return {
      growthScore: 0,
      displayScore: stageScore,
      stageScore,
      baselineReady: false,
      sessionCount: profile?.session_count ?? 0,
    };
  }
  const growthScore = computeGrowthScore(profile, sessionMeans, energyAvailable);
  const displayScore = blendDisplayScore(stageScore, growthScore);
  return {
    growthScore,
    displayScore,
    stageScore,
    baselineReady: true,
    sessionCount: profile.session_count,
  };
}
