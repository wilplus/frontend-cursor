/**
 * Real-time syllable-rate estimator.
 *
 * Counts intensity peaks in a sliding amplitude-envelope buffer.
 * Every syllable has a vowel nucleus → intensity peak.
 * Based on de Jong & Wempe (2009), adapted for browser real-time.
 */

export class SyllableRateDetector {
  private buf: Float32Array;
  private wi = 0;
  private n = 0;
  private readonly sz: number;
  private readonly minGap: number;

  /**
   * @param sampleRate  envelope samples per second (e.g. 40)
   * @param windowSec   sliding window in seconds (default 3)
   */
  constructor(
    private sampleRate = 40,
    windowSec = 3,
  ) {
    this.sz = Math.round(sampleRate * windowSec);
    this.buf = new Float32Array(this.sz);
    // 80ms min between syllable peaks → max ~12.5 syl/s
    this.minGap = Math.max(1, Math.round(sampleRate * 0.08));
  }

  push(rms: number): void {
    this.buf[this.wi] = rms;
    this.wi = (this.wi + 1) % this.sz;
    this.n++;
  }

  getRate(): number {
    const len = Math.min(this.n, this.sz);
    if (len < this.sampleRate) return 0; // need ≥1 s

    const start = this.n >= this.sz ? this.wi : 0;

    // adaptive threshold from non-silent values
    const vals: number[] = [];
    for (let i = 0; i < len; i++) {
      const v = this.buf[(start + i) % this.sz];
      if (v > 1e-4) vals.push(v);
    }
    if (vals.length < 5) return 0;

    vals.sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length * 0.5)];
    const q75 = vals[Math.floor(vals.length * 0.75)];
    const thresh = (median + q75) / 2;

    // count upward crossings with hysteresis + min gap
    let peaks = 0;
    let lastPk = -this.minGap;
    let below = true;

    for (let i = 0; i < len; i++) {
      const v = this.buf[(start + i) % this.sz];
      if (v < thresh * 0.85) {
        below = true;
      } else if (below && v >= thresh && i - lastPk >= this.minGap) {
        peaks++;
        lastPk = i;
        below = false;
      }
    }

    return peaks / (len / this.sampleRate);
  }

  reset(): void {
    this.buf.fill(0);
    this.wi = 0;
    this.n = 0;
  }
}
