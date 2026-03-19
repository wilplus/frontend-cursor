/**
 * EnergyVAD — Multi-feature Voice Activity Detector.
 *
 * Distinguishes genuine speech from noise, tremor vibrations, and
 * microphone artifacts using three independent features extracted
 * from each audio frame:
 *
 *   1. Adaptive SNR  — energy above a slowly-tracked noise floor.
 *      The floor is the 10th-percentile RMS over the last ~5 seconds,
 *      so continuous background noise (fans, A/C) raises the floor and
 *      stops triggering "voiced".
 *
 *   2. Speech-band ratio — fraction of spectral energy in 300–3 400 Hz
 *      divided by total energy.  Tremor-induced mic vibration concentrates
 *      energy below 200 Hz;  broadband noise is flat; real speech has
 *      dominant energy in the speech band.
 *
 *   3. Zero-crossing rate (ZCR) — voiced speech has a moderate ZCR
 *      (~60–150 crossings per second at typical sample rates).
 *      Silence/tremor: very low ZCR.  Unvoiced fricatives: very high ZCR.
 *
 * All three votes are weighted and passed through a light IIR smoother
 * so the output is stable across 50 ms ticks.
 *
 * Usage inside a requestAnimationFrame loop:
 *
 *   const vad = new EnergyVAD();
 *   // ...each tick:
 *   analyser.getFloatTimeDomainData(timeBuf);
 *   analyser.getFloatFrequencyData(freqBuf);
 *   const { isSpeaking, probability } = vad.process(freqBuf, timeBuf, sampleRate, fftSize);
 *
 * Call vad.reset() whenever recording starts to clear the noise floor history.
 */

/** Lower edge of the speech band (Hz). */
const SPEECH_LOW_HZ = 300;
/** Upper edge of the speech band (Hz). */
const SPEECH_HIGH_HZ = 3_400;

/**
 * Number of ~50 ms ticks to keep for noise-floor estimation (≈5 seconds).
 * The 10th-percentile RMS over this window becomes the adaptive floor.
 */
const FLOOR_WINDOW_SIZE = 100;

/** IIR smoothing factor for the output probability (0 = no update, 1 = instant). */
const SMOOTH_ALPHA = 0.18;

/** Minimum probability to consider speech active. */
const SPEAK_THRESHOLD = 0.42;

export interface VADResult {
  /** True when the frame is classified as active speech. */
  isSpeaking: boolean;
  /** Smoothed probability 0–1. */
  probability: number;
}

export class EnergyVAD {
  private floorHistory: number[] = [];
  private smoothedProb = 0;

  reset(): void {
    this.floorHistory = [];
    this.smoothedProb = 0;
  }

  /**
   * Process one audio frame.
   *
   * @param freqData  Output of `AnalyserNode.getFloatFrequencyData()` — dBFS values, length = fftSize/2.
   * @param timeData  Output of `AnalyserNode.getFloatTimeDomainData()` — [-1, 1] samples, length = fftSize.
   * @param sampleRate  AudioContext.sampleRate.
   * @param fftSize    AnalyserNode.fftSize (must match the buffer length passed as timeData).
   */
  process(
    freqData: Float32Array,
    timeData: Float32Array,
    sampleRate: number,
    fftSize: number,
  ): VADResult {
    // ── 1. RMS and dBFS ──────────────────────────────────────────────────────
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    const rms = Math.sqrt(sum / timeData.length);
    const rmsDb = 20 * Math.log10(rms + 1e-8);

    // ── 2. Adaptive noise floor (10th-percentile over sliding window) ────────
    this.floorHistory.push(rmsDb);
    if (this.floorHistory.length > FLOOR_WINDOW_SIZE) this.floorHistory.shift();

    // Sort a copy for percentile; keep unsorted copy for appending.
    const sorted = this.floorHistory.slice().sort((a, b) => a - b);
    const p10idx = Math.max(0, Math.floor(sorted.length * 0.1) - 1);
    const floorDb = sorted[p10idx];

    const snrAboveFloor = rmsDb - floorDb; // positive when louder than ambient

    // ── 3. Speech-band spectral ratio ─────────────────────────────────────────
    const binHz = sampleRate / fftSize;
    let speechPow = 0;
    let totalPow = 0;
    const freqBins = freqData.length; // fftSize / 2

    for (let i = 0; i < freqBins; i++) {
      const hz = i * binHz;
      // Convert dBFS to linear power.
      const pow = Math.pow(10, freqData[i] / 10);
      totalPow += pow;
      if (hz >= SPEECH_LOW_HZ && hz <= SPEECH_HIGH_HZ) speechPow += pow;
    }

    const speechRatio = totalPow > 1e-14 ? speechPow / totalPow : 0;

    // ── 4. Zero-crossing rate ────────────────────────────────────────────────
    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] >= 0) !== (timeData[i - 1] >= 0)) zeroCrossings++;
    }
    // Normalise to crossings-per-second for sample-rate independence.
    const zcr = (zeroCrossings / timeData.length) * sampleRate;

    // ── 5. Feature votes (each 0–1) ──────────────────────────────────────────
    // Energy above noise floor: need > 8 dB for a confident voice
    const energyVote =
      snrAboveFloor > 14
        ? 1.0
        : snrAboveFloor > 8
          ? 0.65
          : snrAboveFloor > 4
            ? 0.25
            : 0.0;

    // Speech-band ratio: real speech occupies > 35% of energy in speech band
    const spectralVote =
      speechRatio > 0.45
        ? 1.0
        : speechRatio > 0.28
          ? 0.6
          : speechRatio > 0.15
            ? 0.25
            : 0.0;

    // ZCR: voiced speech ≈ 2 000–12 000 crossings/sec at 48 kHz
    // Silence/tremor < 1 500 | fricatives > 18 000
    const zcrVote =
      zcr > 2_000 && zcr < 14_000
        ? 1.0
        : zcr > 1_200 && zcr < 18_000
          ? 0.5
          : 0.0;

    // ── 6. Weighted combination + IIR smooth ─────────────────────────────────
    const rawProb = 0.40 * energyVote + 0.35 * spectralVote + 0.25 * zcrVote;
    this.smoothedProb = (1 - SMOOTH_ALPHA) * this.smoothedProb + SMOOTH_ALPHA * rawProb;

    return {
      isSpeaking: this.smoothedProb > SPEAK_THRESHOLD,
      probability: this.smoothedProb,
    };
  }
}
