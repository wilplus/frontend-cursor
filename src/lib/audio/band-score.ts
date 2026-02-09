/**
 * Band score: map a value to 0..1 based on distance from target within tolerance.
 * Used for real-time Strength (dB) and Pace (WPM) only; final score is computed post-upload.
 */

/** Clamp t to [0, 1] then apply smoothstep for smooth falloff at edges. */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Score 0..1: 1 when value equals target, 0 when outside target ± tolerance.
 * Uses smoothstep for smooth transition.
 */
export function bandScore(value: number, target: number, tolerance: number): number {
  const distance = Math.abs(value - target);
  const raw = 1 - distance / tolerance;
  return smoothstep(Math.max(0, Math.min(1, raw)));
}
