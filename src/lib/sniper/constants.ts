/**
 * Live Coach — flow scoring constants.
 * Good speaking pause ratio: 0.15–0.30 of window time.
 */

/** Ideal pause ratio band (100 points inside). */
export const FLOW_IDEAL_LO = 0.15;
export const FLOW_IDEAL_HI = 0.30;
/** Center of the ideal band (used for offset calculation). */
export const FLOW_IDEAL_CENTER = 0.225;
/** Pause ratio above this → score hits 0. */
export const FLOW_MAX_RATIO = 0.60;
/** Max deviation for offset normalisation (±1 at this distance from center). */
export const FLOW_OFFSET_MAX_DEV = 0.18;

/** Coach color thresholds. */
export const COACH_GREEN_THRESHOLD = 75;
export const COACH_YELLOW_THRESHOLD = 50;

/** IIR smoothing factor for performance score display. */
export const SMOOTH_ALPHA = 0.2;
