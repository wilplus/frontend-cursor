/**
 * Live Coach — simplified 2D voice model.
 * Real-time: flow only (pause ratio). Pace added later via X-WPM header.
 */

/** Color state for the live coach indicator. */
export type CoachColor = "green" | "yellow" | "red" | "gray";

/** Live state exposed to SniperGame, SniperWheel, and AudioRecorder. */
export interface LiveCoachState {
  /** Performance score 0–100 (smoothed). Flow-only until live WPM is added. */
  performanceScore: number;
  /** Raw flow score 0–100. Null when silence-gated (not enough voice). */
  flowScore: number | null;
  /**
   * Y-axis offset –1 to +1 for the sniper ball.
   * +1 = too rushed (very few pauses), 0 = balanced, –1 = too choppy (too many pauses).
   */
  flowOffset: number;
  /** X-axis offset (always 0 until live WPM is wired). */
  paceOffset: number;
  /** Coach light color derived from performanceScore. */
  coachColor: CoachColor;
  /** Rolling pause ratio over the last 30 s. */
  pauseRatio: number;
  /** True when voiced ratio is too low to score (user not speaking). */
  silenceGated: boolean;
  /** Human-readable coaching cue. */
  coachingCue: string;
  isActive: boolean;
}

/** Minimal snapshot captured at session end; stored and used for Review + report. */
export interface LiveCoachSnapshot {
  performanceScore: number;
  pauseRatio: number;
  voicedDurationSec: number;
}
