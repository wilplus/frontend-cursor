/**
 * Live Coach — simplified 2D voice model.
 * Real-time: flow (pause ratio) + pace (syllable-onset WPM).
 */

/** Color state for the live coach indicator. */
export type CoachColor = "green" | "yellow" | "red" | "gray";

/** Live state exposed to SniperGame, SniperWheel, and AudioRecorder. */
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
}
