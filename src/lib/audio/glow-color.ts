/**
 * Map chunk metrics to a single HSL color for the ambient glow circle.
 * Contract: dominant issue = lowest score; hue from that metric's delta; brightness from overall score.
 * No blending of two hues.
 */

import type { ChunkMetricsResponse } from "./chunk-metrics-types";

const VOICED_RATIO_SILENCE_THRESHOLD = 0.15;

/** One smoothed frame for the rolling buffer. */
export interface SmoothedFrame {
  pacing_score: number;
  pacing_delta: number;
  intonation_score: number;
  intonation_delta: number;
  pause_score: number;
  pause_delta: number;
}

/** HSL for the circle: h in [0,360), s and l in [0,100]. */
export interface GlowHSL {
  h: number;
  s: number;
  l: number;
}

/** Neutral (silence or no data): soft grey. */
const NEUTRAL: GlowHSL = { h: 0, s: 0, l: 35 };

/** "Good" state when scores are fine and no clear direction (e.g. stub or all good). */
const GOOD: GlowHSL = { h: 140, s: 50, l: 45 };

/** Hue mapping from contract: pacing +/-, intonation -/+, pause. */
const HUE = {
  pacing_fast: 0, // red
  pacing_slow: 220, // blue
  intonation_flat: 0, // grey (s=0)
  intonation_chaotic: 280, // purple
  pause_few: 38, // amber
  pause_many: 25, // orange
} as const;

export function isSilence(voicedRatio: number): boolean {
  return voicedRatio < VOICED_RATIO_SILENCE_THRESHOLD;
}

/**
 * Pick dominant dimension (lowest score) and map to hue using delta sign.
 * Brightness from overall score (min of the three, or average).
 * When overall is high and deltas are ~0 (e.g. stub or "all good"), show soft green.
 */
export function metricsToGlowHSL(frame: SmoothedFrame): GlowHSL {
  const pacing_score = Number(frame.pacing_score);
  const pacing_delta = Number(frame.pacing_delta);
  const intonation_score = Number(frame.intonation_score);
  const intonation_delta = Number(frame.intonation_delta);
  const pause_score = Number(frame.pause_score);
  const pause_delta = Number(frame.pause_delta);

  const overall = Math.min(
    Number.isFinite(pacing_score) ? pacing_score : 1,
    Number.isFinite(intonation_score) ? intonation_score : 1,
    Number.isFinite(pause_score) ? pause_score : 1
  );
  if (!Number.isFinite(overall)) return GOOD;

  const dims = [
    { name: "pacing" as const, score: pacing_score, delta: pacing_delta },
    { name: "intonation" as const, score: intonation_score, delta: intonation_delta },
    { name: "pause" as const, score: pause_score, delta: pause_delta },
  ].map((d) => ({ ...d, score: Number.isFinite(d.score) ? d.score : 1, delta: Number.isFinite(d.delta) ? d.delta : 0 }));

  const worst = dims.reduce((a, b) => (a.score <= b.score ? a : b));

  // Green when all three scores are high (min score > 0.85)
  const minScore = overall;
  if (minScore > 0.85) {
    return { ...GOOD, l: 25 + overall * 45 };
  }

  let h: number;
  let s: number;

  if (worst.name === "pacing") {
    h = worst.delta > 0 ? HUE.pacing_fast : HUE.pacing_slow;
    s = 75;
  } else if (worst.name === "intonation") {
    h = worst.delta < 0 ? HUE.intonation_flat : HUE.intonation_chaotic;
    s = worst.delta < 0 ? 0 : 70;
  } else {
    h = worst.delta < 0 ? HUE.pause_few : HUE.pause_many;
    s = 65;
  }

  const l = 25 + overall * 45;
  return { h, s, l };
}

/**
 * EMA over last N frames. Alpha ≈ 0.25 for 8 frames gives smooth response.
 */
const SMOOTHING_ALPHA = 0.25;
const SMOOTHING_WINDOW = 8;

export function smoothFrames(frames: SmoothedFrame[]): SmoothedFrame {
  if (frames.length === 0) {
    return {
      pacing_score: 1,
      pacing_delta: 0,
      intonation_score: 1,
      intonation_delta: 0,
      pause_score: 1,
      pause_delta: 0,
    };
  }
  const tail = frames.slice(-SMOOTHING_WINDOW);
  let pScore = tail[0].pacing_score;
  let pDelta = tail[0].pacing_delta;
  let iScore = tail[0].intonation_score;
  let iDelta = tail[0].intonation_delta;
  let paScore = tail[0].pause_score;
  let paDelta = tail[0].pause_delta;
  for (let i = 1; i < tail.length; i++) {
    pScore = SMOOTHING_ALPHA * tail[i].pacing_score + (1 - SMOOTHING_ALPHA) * pScore;
    pDelta = SMOOTHING_ALPHA * tail[i].pacing_delta + (1 - SMOOTHING_ALPHA) * pDelta;
    iScore = SMOOTHING_ALPHA * tail[i].intonation_score + (1 - SMOOTHING_ALPHA) * iScore;
    iDelta = SMOOTHING_ALPHA * tail[i].intonation_delta + (1 - SMOOTHING_ALPHA) * iDelta;
    paScore = SMOOTHING_ALPHA * tail[i].pause_score + (1 - SMOOTHING_ALPHA) * paScore;
    paDelta = SMOOTHING_ALPHA * tail[i].pause_delta + (1 - SMOOTHING_ALPHA) * paDelta;
  }
  return {
    pacing_score: pScore,
    pacing_delta: pDelta,
    intonation_score: iScore,
    intonation_delta: iDelta,
    pause_score: paScore,
    pause_delta: paDelta,
  };
}

/** Coerce backend response to frame; use safe defaults for missing/invalid fields. */
export function responseToFrame(r: ChunkMetricsResponse): SmoothedFrame {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    pacing_score: num(r.pacing_score, 1),
    pacing_delta: num(r.pacing_delta, 0),
    intonation_score: num(r.intonation_score, 1),
    intonation_delta: num(r.intonation_delta, 0),
    pause_score: num(r.pause_score, 1),
    pause_delta: num(r.pause_delta, 0),
  };
}

export function hslToCss(hsl: GlowHSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
