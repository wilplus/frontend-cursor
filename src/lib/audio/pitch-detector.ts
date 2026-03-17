/**
 * Real-time fundamental frequency (F0) detection via Hamming-windowed autocorrelation.
 * Designed for live voice analysis in the Sniper Wheel.
 *
 * Algorithm: normalized autocorrelation over a 2048-sample Hamming-windowed buffer.
 * Returns Hz in the human voice range (75–500 Hz), or null if confidence is too low.
 *
 * Performance: ~500K multiply-adds per call. Safe to run every 200 ms in a RAF loop.
 */

/** Autocorrelation buffer size. At 44100 Hz → ~46 ms; at 48000 Hz → ~43 ms. */
const N = 2048;

/** Minimum normalized correlation to accept a pitch candidate (rejects noise/silence). */
const CONFIDENCE_MIN = 0.15;

/** Pre-allocated reusable buffer — avoids GC pressure in the hot path. */
const _winBuf = new Float32Array(N);

/**
 * Detect fundamental frequency from a block of audio samples.
 *
 * @param buf        Float32Array from AnalyserNode.getFloatTimeDomainData (uses first N samples)
 * @param sampleRate AudioContext.sampleRate (e.g. 44100 or 48000)
 * @returns Hz in [75, 500] if confident, null otherwise
 */
export function detectPitchHz(buf: Float32Array, sampleRate: number): number | null {
  // Apply Hamming window and accumulate power.
  let power = 0;
  for (let i = 0; i < N; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    const v = buf[i] * w;
    _winBuf[i] = v;
    power += v * v;
  }
  // Gate on silence — prevents false positives on quiet frames.
  if (power < 1e-10) return null;

  // Lag range corresponds to human voice F0: 75 Hz → 500 Hz.
  const minLag = Math.floor(sampleRate / 500); // ≈ 88 @ 44100
  const maxLag = Math.min(N - 1, Math.ceil(sampleRate / 75)); // ≈ 588 @ 44100

  let bestLag = -1;
  let bestCorr = CONFIDENCE_MIN; // initialized to threshold — only accept above it

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const lim = N - lag;
    for (let i = 0; i < lim; i++) corr += _winBuf[i] * _winBuf[i + lag];
    // Normalize by total power so correlation is in [−1, 1].
    const normCorr = corr / power;
    if (normCorr > bestCorr) {
      bestCorr = normCorr;
      bestLag = lag;
    }
  }

  if (bestLag < 0) return null;
  return sampleRate / bestLag;
}

/**
 * Convert Hz to semitones relative to 100 Hz (log-scale, perceptually uniform).
 * 100 Hz → 0 st; 200 Hz → 12 st; 400 Hz → 24 st.
 */
export function hzToSemitones(hz: number): number {
  return 12 * Math.log2(hz / 100);
}
