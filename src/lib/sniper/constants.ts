/**
 * Sniper Wheel — Public Speaking Mode v1
 * Ideals, tolerances, zone bounds, and weights.
 * All values are documented for calibration and validation.
 */

import type { SniperTier } from "./types";

/** Pace (WPM): ideal center and tolerance for Gaussian scoring. */
export const PACE_IDEAL_WPM = 147;
export const PACE_TOLERANCE_WPM = 8;
export const PACE_GREEN_LO = 140;
export const PACE_GREEN_HI = 155;
export const PACE_YELLOW_LO = 130;
export const PACE_YELLOW_HI = 165;
/** Below or above = red; score capped at 40. */
export const PACE_CAP_BELOW = 130;
export const PACE_CAP_ABOVE = 165;
/** Variance bonus: if segment WPM spread ≥ this, +5 to pace score (capped 100). */
export const PACE_VARIANCE_BONUS_WPM = 40;
/** Soft floor: no score below this unless catastrophic. Pace 55. */
export const PACE_SOFT_FLOOR = 55;
/** Catastrophic zone: WPM outside this bypasses soft floor; score clamped to 30–40. */
export const PACE_CATASTROPHIC_LO = 110;
export const PACE_CATASTROPHIC_HI = 190;

/** Pause (avg ms): ideal and tolerance. */
export const PAUSE_IDEAL_MS = 440;
export const PAUSE_TOLERANCE_MS = 70;
export const PAUSE_GREEN_LO = 400;
export const PAUSE_GREEN_HI = 480;
export const PAUSE_YELLOW_LO = 320;
export const PAUSE_YELLOW_HI = 600;
/** Speech density > this → -10 penalty. */
export const PAUSE_DENSITY_PENALTY_ABOVE = 0.82;
/** No pause > this in 3 min → -15 structural penalty. */
export const PAUSE_LONG_PAUSE_MS = 1500;
export const PAUSE_LONG_PAUSE_WINDOW_SEC = 180;
/** Soft floor for pause. */
export const PAUSE_SOFT_FLOOR = 55;

/** Dynamic range (dB): ideal and tolerance. */
export const DYNAMIC_IDEAL_DB = 14;
export const DYNAMIC_TOLERANCE_DB = 2;
export const DYNAMIC_GREEN_LO = 12;
export const DYNAMIC_GREEN_HI = 16;
export const DYNAMIC_YELLOW_LO = 9;
export const DYNAMIC_YELLOW_HI = 18;
/** Hard cap when < 9 or > 18. */
export const DYNAMIC_CAP_SCORE = 35;
/** RMS instability > this (dB) → -10. */
export const DYNAMIC_RMS_INSTABILITY_DB = 5;
/** Soft floor for dynamic. */
export const DYNAMIC_SOFT_FLOOR = 60;
/** Catastrophic: dynamic range below this bypasses soft floor; score 30–40. */
export const DYNAMIC_CATASTROPHIC_LO = 6;

/** Emphasis (true rhetorical spikes/min): ideal and tolerance. */
export const EMPHASIS_IDEAL_PER_MIN = 35;
export const EMPHASIS_TOLERANCE = 8;
export const EMPHASIS_GREEN_LO = 25;
export const EMPHASIS_GREEN_HI = 45;
export const EMPHASIS_YELLOW_LO = 15;
export const EMPHASIS_YELLOW_HI = 60;
/** Below this → cap score at 40. */
export const EMPHASIS_CAP_BELOW = 15;
/** Low clustering / monotone → -5 naturalness. */
export const EMPHASIS_MONOTONE_PENALTY = 5;
/** Soft floor for emphasis. */
export const EMPHASIS_SOFT_FLOOR = 60;
/** Catastrophic: emphasis below this bypasses soft floor; score 30–40. */
export const EMPHASIS_CATASTROPHIC_LO = 8;

/** Energy arc: minimum session duration (sec) before energy score is computed. */
export const ENERGY_MIN_SESSION_SEC = 120;
/** E3 ≥ E2 → +20 structural bonus. */
export const ENERGY_RECOVERY_BONUS = 20;
/** E3 < E2 by more than this ratio → -25. */
export const ENERGY_DECLINE_PENALTY_RATIO = 0.15;
export const ENERGY_DECLINE_PENALTY = 25;
/** Base energy score before modifiers. */
export const ENERGY_BASE_SCORE = 70;

/** Segment weights for overall score (sum = 1). */
export const WEIGHTS = {
  pace: 0.18,
  pause: 0.18,
  dynamic: 0.18,
  emphasis: 0.16,
  energy: 0.3,
} as const;

/** When energy is unavailable (<2 min), reweight the other four so they sum to 1. */
const WEIGHT_SUM_WITHOUT_ENERGY = WEIGHTS.pace + WEIGHTS.pause + WEIGHTS.dynamic + WEIGHTS.emphasis;
export const WEIGHTS_WITHOUT_ENERGY = {
  pace: WEIGHTS.pace / WEIGHT_SUM_WITHOUT_ENERGY,
  pause: WEIGHTS.pause / WEIGHT_SUM_WITHOUT_ENERGY,
  dynamic: WEIGHTS.dynamic / WEIGHT_SUM_WITHOUT_ENERGY,
  emphasis: WEIGHTS.emphasis / WEIGHT_SUM_WITHOUT_ENERGY,
} as const;

/** Tier boundaries (inclusive) and labels. */
export const TIER_BOUNDS: Array<{ min: number; max: number; tier: SniperTier }> = [
  { min: 92, max: 100, tier: "executive_calibrated" },
  { min: 85, max: 91, tier: "stage_ready" },
  { min: 75, max: 84, tier: "structured" },
  { min: 60, max: 74, tier: "developing_control" },
  { min: 0, max: 59, tier: "unstable_delivery" },
];

/** Hysteresis: require score to stay in new tier for this many updates before switching (reduces flicker). */
export const TIER_HYSTERESIS_UPDATES = 3;

/** Adaptive layer: blend stage (benchmark) + growth (vs personal baseline). */
export const BLEND_STAGE_WEIGHT = 0.7;
export const BLEND_GROWTH_WEIGHT = 0.3;
/** EMA for baseline update: new = (1 - EMA_ALPHA) * old + EMA_ALPHA * session_mean. */
export const EMA_ALPHA = 0.2;
/** Baseline "ready" when session_count >= this and at least one session had energy. */
export const MIN_SESSIONS_FOR_BASELINE = 3;
/** Only update baseline when session stage score and voiced duration meet these (anti-gaming). */
export const MIN_STAGE_SCORE_FOR_BASELINE_UPDATE = 60;
export const MIN_VOICED_SEC_FOR_BASELINE_UPDATE = 60;
