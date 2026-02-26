/**
 * 1€ Filter — Casiez, Roussel, Vogel (CHI 2012)
 *
 * Adaptive low-pass for real-time signals.
 * Stable signal → heavy smoothing → no jitter.
 * Fast movement → light smoothing → no lag.
 *
 * Three parameters:
 *   minCutoff  lower = smoother when still
 *   beta       higher = more responsive to movement
 *   dCutoff    derivative smoothing (usually 1.0)
 */

class LowPass {
  private y = 0;
  private ready = false;

  filter(x: number, alpha: number): number {
    if (!this.ready) {
      this.y = x;
      this.ready = true;
      return x;
    }
    this.y += alpha * (x - this.y);
    return this.y;
  }

  value(): number {
    return this.y;
  }

  reset(): void {
    this.ready = false;
    this.y = 0;
  }
}

export class OneEuroFilter {
  private xF = new LowPass();
  private dxF = new LowPass();
  private lastT: number | null = null;

  constructor(
    private minCutoff = 1.0,
    private beta = 0.007,
    private dCutoff = 1.0,
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, tSec: number): number {
    if (this.lastT === null) {
      this.lastT = tSec;
      this.dxF.filter(0, 1);
      return this.xF.filter(value, 1);
    }
    const dt = Math.max(tSec - this.lastT, 1e-6);
    this.lastT = tSec;

    const dx = (value - this.xF.value()) / dt;
    this.dxF.filter(dx, this.alpha(this.dCutoff, dt));

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxF.value());
    return this.xF.filter(value, this.alpha(cutoff, dt));
  }

  reset(): void {
    this.lastT = null;
    this.xF.reset();
    this.dxF.reset();
  }
}
