/**
 * Pause-only glow: map pause_score ∈ [0,1] to brightness (fixed hue).
 * 1 = ideal pausing → bright; 0 = bad → dim.
 */

const VOICED_RATIO_SILENCE_THRESHOLD = 0.15;

/** HSL for the circle: fixed greenish hue, brightness from pause_score. */
export interface GlowHSL {
  h: number;
  s: number;
  l: number;
}

/** Hue 140 (green), saturation 70%; lightness = 22% + 50% * pause_score. */
const HUE = 140;
const SATURATION = 70;
const L_MIN = 22;
const L_RANGE = 50;

export function isSilence(voicedRatio: number): boolean {
  return voicedRatio < VOICED_RATIO_SILENCE_THRESHOLD;
}

/**
 * Map pause_score to glow color. Fixed hue (green); brightness = f(pause_score).
 * pause_score 1 → bright, 0 → dim.
 */
export function pauseScoreToGlowHSL(pauseScore: number): GlowHSL {
  const s = Math.max(0, Math.min(1, Number(pauseScore)));
  const l = L_MIN + L_RANGE * s;
  return { h: HUE, s: SATURATION, l };
}

/**
 * Running EMA: smooth_score = alpha * new + (1 - alpha) * prev.
 * Doc: "pause_score_smooth = 0.2*new + 0.8*old"
 */
export const PAUSE_EMA_ALPHA = 0.2;

export function smoothPauseScore(newScore: number, previousSmoothed: number): number {
  return PAUSE_EMA_ALPHA * newScore + (1 - PAUSE_EMA_ALPHA) * previousSmoothed;
}

/** Extract and coerce pause_score from chunk response; default 1 if missing. */
export function getPauseScoreFromResponse(data: { pause_score?: unknown }): number {
  const v = data.pause_score;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  return 1;
}

export function hslToCss(hsl: GlowHSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
