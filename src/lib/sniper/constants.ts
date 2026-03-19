/**
 * Live Coach — scoring constants for flow (pause ratio) and pace (syllable-onset WPM).
 */

// ── Flow ────────────────────────────────────────────────────────────────────

/** Ideal pause ratio band (100 points inside). */
export const FLOW_IDEAL_LO = 0.15;
export const FLOW_IDEAL_HI = 0.30;
/** Center of the ideal band (used for offset calculation). */
export const FLOW_IDEAL_CENTER = 0.225;
/** Pause ratio above this → score hits 0. */
export const FLOW_MAX_RATIO = 0.60;
/** Max deviation for offset normalisation (±1 at this distance from center). */
export const FLOW_OFFSET_MAX_DEV = 0.18;

// ── Pace ────────────────────────────────────────────────────────────────────

/** Ideal WPM band (100 points inside). */
export const PACE_IDEAL_LO = 125;
export const PACE_IDEAL_HI = 165;
/** Center of the ideal WPM band. */
export const PACE_IDEAL_CENTER = 145;
/** WPM below this → score 0. */
export const PACE_SLOW_MIN = 80;
/** WPM above this → score 0. */
export const PACE_FAST_MAX = 210;
/** paceOffset ±1 at this deviation from center. */
export const PACE_OFFSET_MAX_DEV = 45;
/** Rolling window (seconds) for onset-based WPM estimate. */
export const PACE_WINDOW_SEC = 10;
/** Average syllables per word in conversational English. */
export const AVG_SYLLABLES_PER_WORD = 1.5;
/** Minimum onsets in window before we report WPM. */
export const PACE_MIN_ONSETS = 5;

// ── Coach UI ─────────────────────────────────────────────────────────────────

/** Coach color thresholds. */
export const COACH_GREEN_THRESHOLD = 75;
export const COACH_YELLOW_THRESHOLD = 50;

/** IIR smoothing factor for performance score display. */
export const SMOOTH_ALPHA = 0.2;

// ── Legacy 6-metric wheel constants (used by control-signals + BiofeedbackMode) ─

export const PACE_IDEAL_WPM = 147;
export const PACE_TOLERANCE_WPM = 8;
export const PAUSE_IDEAL_MS = 440;
export const PAUSE_TOLERANCE_MS = 70;
export const DYNAMIC_IDEAL_DB = 14;
export const DYNAMIC_TOLERANCE_DB = 2;
export const EMPHASIS_IDEAL_PER_MIN = 35;
export const EMPHASIS_TOLERANCE = 8;
export const PITCH_IDEAL_RANGE_ST = 8;
export const PITCH_TOLERANCE_ST = 2;

// ── Legacy adaptive-baseline constants (used by API routes + baseline-update) ─

/** EMA alpha for baseline update: new = (1 - EMA_ALPHA) * old + EMA_ALPHA * session_mean. */
export const EMA_ALPHA = 0.2;
/** Only update baseline when session stage score meets this minimum (anti-gaming). */
export const MIN_STAGE_SCORE_FOR_BASELINE_UPDATE = 60;
/** Only update baseline when voiced duration (seconds) meets this minimum. */
export const MIN_VOICED_SEC_FOR_BASELINE_UPDATE = 60;
