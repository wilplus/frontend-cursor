/**
 * Sniper Wheel — Elite Performance Coach (Public Speaking)
 * Type definitions for metrics, scores, and UI state.
 */

/** Confidence level for a metric (used for graceful degradation). */
export type MetricConfidence = "high" | "low" | "insufficient";

/** Tier label for overall voice alignment. */
export type SniperTier =
  | "executive_calibrated"
  | "stage_ready"
  | "structured"
  | "developing_control"
  | "unstable_delivery";

/** Zone for a single metric (green = optimal, yellow = drift, red = out of range). */
export type Zone = "green" | "yellow" | "red";

/** Raw metric values from the audio pipeline (rolling window). */
export interface SniperMetricState {
  /** Words per minute (from syllable rate). */
  paceWpm: number;
  /** Average pause length in ms. */
  avgPauseMs: number;
  /** Longest pause in current window (ms). */
  longestPauseMs: number;
  /** Speech density 0–1 (speaking time / total time). */
  speechDensity: number;
  /** Dynamic range in dB (peak − baseline over window). */
  dynamicRangeDb: number;
  /** Rhetorical emphasis events per minute (syllable-aligned, filtered). */
  emphasisPerMin: number;
  /** Relative energy by third (0–1 normalized to session baseline). Only set after ~2 min. */
  energyByThird: { e1: number; e2: number; e3: number } | null;
  /** Session total duration so far (seconds). Used for energy normalization. */
  sessionDurationSec: number;
  /** Confidence per metric for graceful degradation. */
  confidence: {
    pace: MetricConfidence;
    pause: MetricConfidence;
    dynamic: MetricConfidence;
    emphasis: MetricConfidence;
    energy: MetricConfidence;
  };
}

/** Normalized scores 0–100 per segment. */
export interface SniperScores {
  pace: number;
  pause: number;
  dynamic: number;
  emphasis: number;
  energy: number;
}

/** Full state exposed to the Sniper Wheel and coaching UI. */
export interface SniperState {
  metrics: SniperMetricState;
  scores: SniperScores;
  overallScore: number;
  tier: SniperTier;
  /** Single primary coaching cue (empty when no correction needed). */
  coachingCue: string;
  /** Which segment is driving the primary cue (for UI emphasis). */
  coachingSegment: keyof SniperScores | null;
  /** False when session <2 min: energy excluded from overall score, reweight applied. */
  energyAvailable: boolean;
  isActive: boolean;
}

/** Raw session means for baseline update (store these, not scores). */
export interface SniperSessionMeans {
  paceWpm: number;
  avgPauseMs: number;
  dynamicRangeDb: number;
  emphasisPerMin: number;
  /** E3/E2 when available; otherwise omit or 1. */
  energyRatio: number | null;
  /** voiced_duration_sec for quality gate (sessionDurationSec * speechDensity). */
  voicedDurationSec: number;
}

/** Snapshot for post-session Review Summary (strongest area, needs work, fatigue). */
export interface SniperSessionSnapshot {
  overallScore: number;
  tier: SniperTier;
  strongestSegment: keyof SniperScores;
  needsWorkSegment: keyof SniperScores;
  fatigueDetected: boolean;
  /** Session means from final window (for baseline update and growth). */
  sessionMeans: SniperSessionMeans;
}

/** Per-user adaptive baseline (DB: user_sniper_profile). Baselines nullable until first session. */
export interface UserSniperProfile {
  user_id: string;
  session_count: number;
  sessions_with_energy_count: number;
  baseline_wpm: number | null;
  baseline_pause_ms: number | null;
  baseline_dynamic_db: number | null;
  baseline_emphasis_per_min: number | null;
  baseline_energy_ratio: number | null;
  baseline_fatigue_sec?: number | null;
  created_at: string;
  updated_at: string;
}

/** Result of growth computation (null when baseline not ready). */
export interface SniperGrowthResult {
  growthScore: number;
  displayScore: number;
  stageScore: number;
  baselineReady: boolean;
  sessionCount: number;
}

const SEGMENT_KEYS: (keyof SniperScores)[] = ["pace", "pause", "dynamic", "emphasis", "energy"];

/** Build snapshot from current state for Review Summary (includes session means for baseline/growth). */
export function buildSniperSnapshot(state: SniperState): SniperSessionSnapshot {
  const scores = state.scores;
  const considerKeys = state.energyAvailable
    ? SEGMENT_KEYS
    : (SEGMENT_KEYS.filter((k) => k !== "energy") as (keyof SniperScores)[]);
  let strongest: keyof SniperScores = "pace";
  let needsWork: keyof SniperScores = "pace";
  for (const k of considerKeys) {
    if (scores[k] > scores[strongest]) strongest = k;
    if (scores[k] < scores[needsWork]) needsWork = k;
  }
  const m = state.metrics;
  const e = m.energyByThird;
  const fatigueDetected =
    !!e && e.e2 > 1e-8 && (e.e2 - e.e3) / e.e2 > 0.15;
  const energyRatio =
    e && e.e2 > 1e-8 ? e.e3 / e.e2 : null;
  const voicedDurationSec = m.sessionDurationSec * m.speechDensity;
  const sessionMeans: SniperSessionMeans = {
    paceWpm: m.paceWpm,
    avgPauseMs: m.avgPauseMs,
    dynamicRangeDb: m.dynamicRangeDb,
    emphasisPerMin: m.emphasisPerMin,
    energyRatio,
    voicedDurationSec,
  };
  return {
    overallScore: state.overallScore,
    tier: state.tier,
    strongestSegment: strongest,
    needsWorkSegment: needsWork,
    fatigueDetected,
    sessionMeans,
  };
}
