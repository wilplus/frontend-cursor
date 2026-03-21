/**
 * Live Coach — legacy flow + pace 2D voice model.
 * These types back the older sniper-style field where flow maps to Y and pace
 * maps to X. The current homework recorder uses `StrengthPaceDartboard`
 * instead, with X = strength and Y = pace.
 */

/** Color state for the live coach indicator. */
export type CoachColor = "green" | "yellow" | "red" | "gray";

/** Live state exposed to the legacy sniper game components. */
export interface LiveCoachState {
  /** Performance score 0–100 (smoothed). Blend of flow + pace; flow-only during pace warm-up. */
  performanceScore: number;
  /** Raw flow score 0–100. Null when silence-gated. */
  flowScore: number | null;
  /**
   * Y-axis offset –1 to +1 for the sniper ball.
   * +1 = too rushed (very few pauses), 0 = balanced, –1 = too choppy (too many pauses).
   */
  flowOffset: number;
  /**
   * X-axis offset –1 to +1 for the sniper ball.
   * +1 = too fast, 0 = ideal (145 WPM), –1 = too slow.
   * Zero during pace warm-up (first ~10 s).
   */
  paceOffset: number;
  /** Coach light color derived from performanceScore. */
  coachColor: CoachColor;
  /** Rolling pause ratio over the last 30 s. */
  pauseRatio: number;
  /**
   * Syllable-onset WPM estimate over the last 10 s.
   * Null during warm-up (< 5 onsets detected).
   */
  wpm: number | null;
  /** Confidence 0..1 for pace estimate reliability (onset warm-up). */
  paceConfidence: number;
  /** Last few pause ratios for future trend visualization/debug. */
  recentPauseRatios: number[];
  /** True after holding inside the dead zone long enough. */
  locked: boolean;
  /** Monotonic counter incremented when a filler is detected live. */
  fillerFlashNonce: number;
  /** True when voiced ratio is too low to score (user not speaking). */
  silenceGated: boolean;
  /** Human-readable coaching cue (worst dimension). */
  coachingCue: string;
  isActive: boolean;
}

/** Minimal snapshot captured at session end; stored and used for Review + report. */
export interface LiveCoachSnapshot {
  performanceScore: number;
  pauseRatio: number;
  voicedDurationSec: number;
  wpm: number | null;
  pitchCenterSt?: number | null;
  pitchFrameCount?: number;
  realtimeLevel?: number;
  realtimeStep?: number;
  centerHoldRatio?: number;
  centerHoldMs?: number;
  totalActiveMs?: number;
}

// ── Legacy types — kept for API routes and HomeworkFlowCard compatibility ─────

/** Per-session acoustic means sent to the adaptive-baseline API routes. */
export interface SniperSessionMeans {
  paceWpm: number;
  avgPauseMs: number;
  dynamicRangeDb: number;
  emphasisPerMin: number;
  energyRatio: number | null;
  voicedDurationSec: number;
  pitchCenterSt?: number | null;
  pitchFrameCount?: number | null;
  pitchRangeSt?: number | null;
}

/** Tier labels used by the legacy 6-metric sniper wheel. */
export type SniperTier =
  | "executive_calibrated"
  | "stage_ready"
  | "structured"
  | "developing_control"
  | "unstable_delivery";

/** Per-segment scores from the legacy 6-metric wheel. */
export interface SniperScores {
  pace: number;
  pause: number;
  dynamic: number;
  emphasis: number;
  energy: number;
  pitch: number;
}

/** Snapshot used by HomeworkFlowCard review step (legacy). */
export interface SniperSessionSnapshot {
  overallScore: number;
  tier: SniperTier;
  strongestSegment: keyof SniperScores;
  needsWorkSegment: keyof SniperScores;
  fatigueDetected: boolean;
  sessionMeans: SniperSessionMeans;
}

/** Per-user adaptive baseline stored in user_sniper_profile. */
export interface UserSniperProfile {
  user_id: string;
  session_count: number;
  sessions_with_energy_count: number;
  sessions_with_pitch_count?: number;
  baseline_wpm: number | null;
  baseline_pause_ms: number | null;
  baseline_dynamic_db: number | null;
  baseline_emphasis_per_min: number | null;
  baseline_energy_ratio: number | null;
  realtime_level?: number;
  realtime_step?: number;
  realtime_pitch_baseline_st?: number | null;
  baseline_pitch_range_st?: number | null;
  baseline_fatigue_sec?: number | null;
  created_at: string;
  updated_at: string;
}

/** Growth computation result (legacy). */
export interface SniperGrowthResult {
  growthScore: number;
  displayScore: number;
  stageScore: number;
  baselineReady: boolean;
  sessionCount: number;
}

/** Per-metric real-time state from the legacy 6-metric hook (used by BiofeedbackMode). */
export interface SniperMetricState {
  paceWpm: number;
  avgPauseMs: number;
  longestPauseMs: number;
  speechDensity: number;
  dynamicRangeDb: number;
  emphasisPerMin: number;
  energyByThird: { e1: number; e2: number; e3: number } | null;
  pitchRangeSt: number | null;
  sessionDurationSec: number;
}
