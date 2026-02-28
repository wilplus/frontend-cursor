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
  isActive: boolean;
}
