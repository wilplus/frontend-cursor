/**
 * Band score: map a value to 0..1 based on distance from target within tolerance.
 * Used for real-time Strength (dB) and Pace (WPM) only; final score is computed post-upload.
 */

/** Clamp t to [0, 1] then apply smoothstep for smooth falloff at edges. */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Gentler ease-in-out for smoother needle motion. */
export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Score 0..1: 1 when value equals target, 0 when outside target ± tolerance.
 * Uses smoothstep + easeInOutCubic for smooth, gentle transition.
 */
export function bandScore(value: number, target: number, tolerance: number): number {
  const distance = Math.abs(value - target);
  const raw = 1 - distance / tolerance;
  const stepped = smoothstep(Math.max(0, Math.min(1, raw)));
  return easeInOutCubic(stepped);
}
