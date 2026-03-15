"use client";

/**
 * Behavioral strength + pace feedback (deviation accumulator).
 *
 * The sniper reflects sustained pattern deviation, not instantaneous audio.
 * - Stay centered while within healthy range.
 * - Only start drifting if deviation persists.
 * - Drift slowly. Recover quickly when behavior returns to healthy.
 *
 * Outputs targetX, targetY in [-1, +1] from drift accumulators.
 */

import { useCallback, useRef, useState } from "react";
import { OneEuroFilter } from "@/lib/audio/one-euro-filter";
import { SyllableRateDetector } from "@/lib/audio/syllable-rate";

/* ─── constants ──────────────────────────────────────────────── */

// strength (perceptual loudness)
const TARGET_DB = -26;
const DB_TOLERANCE = 10;
const STRENGTH_QUIET_SOFTEN = 0.5;
/** Within this normalized band = healthy (no drift). Tighter = strength axis actually moves. */
const HEALTHY_STRENGTH = 0.35;

// pace (syllable rate)
const TARGET_SYL = 3.5;
const SYL_TOLERANCE = 2.0;
const SYL_PER_WORD = 1.4;
/** Healthy pace zone (syl/s) — slightly wider so small variation doesn't constantly drift */
const SYL_HEALTHY_LO = 3.2;
const SYL_HEALTHY_HI = 4.6;

// timing
const TICK_MS = 50;
const FFT_SIZE = 4096;
const SUB_FRAMES = 2;

// voice activity
const VOICE_RMS = 0.006;
const SILENCE_GRACE_MS = 350;
/** Pause shorter than this = healthy (no drift). Longer = start drifting down. */
const SILENCE_HEALTHY_MS = 1500;

// accumulator: drift rate per second when outside healthy zone — faster = more dynamic
const DRIFT_STRENGTH_PER_S = 0.55;
const DRIFT_PACE_PER_S = 0.50;
const DRIFT_SILENCE_PER_S = 0.28;
/** When in healthy zone: decay per tick (fast recovery) */
const RECOVERY_DECAY = 0.88;

// 1€ filter (light smoothing for zone decisions only)
const STR_MIN_CUT = 0.8;
const STR_BETA = 0.004;
const PACE_MIN_CUT = 0.4;
const PACE_BETA = 0.002;

/* ─── types ──────────────────────────────────────────────────── */

export interface UseRealtimeStrengthPaceResult {
  targetX: number;
  targetY: number;
  strengthDb: number;
  wpmEstimate: number;
  score: number;
  isActive: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ─── hook ───────────────────────────────────────────────────── */

export function useRealtimeStrengthPace(): UseRealtimeStrengthPaceResult {
  const [state, setState] = useState({
    targetX: 0,
    targetY: 0,
    strengthDb: -60,
    wpmEstimate: 0,
    score: 1,
    isActive: false,
  });

  const r = useRef({
    ctx: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    raf: 0,
    lastTick: 0,
    lastVoice: 0,
    buf: null as Float32Array | null,
    strF: new OneEuroFilter(STR_MIN_CUT, STR_BETA),
    paceF: new OneEuroFilter(PACE_MIN_CUT, PACE_BETA),
    syl: new SyllableRateDetector(SUB_FRAMES * (1000 / TICK_MS), 3),
    driftX: 0,
    driftY: 0,
  });

  const start = useCallback((stream: MediaStream) => {
    const s = r.current;

    if (s.ctx) {
      cancelAnimationFrame(s.raf);
      s.ctx.close();
    }

    // Match sample rate to the actual track so the WebAudio renderer never gets a
    // mismatch (same root cause as the Bluetooth A2DP→HFP switch error in sniper mode).
    const trackSampleRate = stream.getAudioTracks()[0]?.getSettings().sampleRate;
    const ctx = new AudioContext(trackSampleRate ? { sampleRate: trackSampleRate } : undefined);
    const src = ctx.createMediaStreamSource(stream);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    hp.Q.value = 0.707;

    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 2000;
    hs.gain.value = 3;

    const an = ctx.createAnalyser();
    an.fftSize = FFT_SIZE;
    an.smoothingTimeConstant = 0;

    src.connect(hp).connect(hs).connect(an);

    s.ctx = ctx;
    s.analyser = an;
    s.buf = new Float32Array(FFT_SIZE);
    s.lastTick = performance.now();
    s.lastVoice = performance.now();
    s.strF.reset();
    s.paceF.reset();
    s.syl.reset();
    s.driftX = 0;
    s.driftY = 0;

    setState(prev => ({ ...prev, isActive: true }));

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const elapsed = now - s.lastTick;
      if (elapsed < TICK_MS) return;
      s.lastTick = now;
      const dt = elapsed / 1000;

      if (!s.analyser || !s.buf || !s.ctx) return;
      if (s.ctx.state === "suspended") {
        s.ctx.resume();
        return;
      }

      s.analyser.getFloatTimeDomainData(s.buf as Float32Array<ArrayBuffer>);

      let sum = 0;
      const d = s.buf;
      const len = d.length;
      for (let i = 0; i < len; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / len);
      const dB = 20 * Math.log10(rms + 1e-8);

      const fSz = (len / SUB_FRAMES) | 0;
      for (let f = 0; f < SUB_FRAMES; f++) {
        let fs = 0;
        const off = f * fSz;
        for (let i = 0; i < fSz; i++) fs += d[off + i] * d[off + i];
        s.syl.push(Math.sqrt(fs / fSz));
      }
      const sylRate = s.syl.getRate();
      const wpm = sylRate * (60 / SYL_PER_WORD);

      const voiced = rms > VOICE_RMS;
      if (voiced) s.lastVoice = now;
      const silenceMs = now - s.lastVoice;

      // ── normalized signals for zone decisions (light 1€ so zone doesn't flicker) ──
      let rawStr = 0;
      if (dB >= -50) {
        rawStr = (dB - TARGET_DB) / DB_TOLERANCE;
        if (rawStr < 0) rawStr *= STRENGTH_QUIET_SOFTEN;
        rawStr = clamp(rawStr, -1, 1);
      }
      const t = now / 1000;
      const zStr = s.strF.filter(rawStr, t);

      let rawPace = 0;
      if (sylRate > 0) {
        rawPace = (sylRate - TARGET_SYL) / SYL_TOLERANCE;
        rawPace = clamp(rawPace, -1, 1);
      }
      const zPace = s.paceF.filter(rawPace, t);

      // ── behavioral accumulator: only drift when sustained outside healthy zone ──

      if (silenceMs > SILENCE_GRACE_MS) {
        // Pause mode: strength drifts back to center; silence length drives Y
        s.driftX *= RECOVERY_DECAY;
        if (silenceMs < SILENCE_HEALTHY_MS) {
          s.driftY *= RECOVERY_DECAY;
        } else {
          s.driftY -= dt * DRIFT_SILENCE_PER_S;
        }
      } else {
        // Speaking: strength accumulator
        if (Math.abs(zStr) < HEALTHY_STRENGTH) {
          s.driftX *= RECOVERY_DECAY;
        } else if (zStr > HEALTHY_STRENGTH) {
          s.driftX += dt * DRIFT_STRENGTH_PER_S;
        } else {
          s.driftX -= dt * DRIFT_STRENGTH_PER_S;
        }

        // Pace accumulator (only when we have pace data)
        if (sylRate <= 0) {
          s.driftY *= RECOVERY_DECAY;
        } else if (sylRate >= SYL_HEALTHY_LO && sylRate <= SYL_HEALTHY_HI) {
          s.driftY *= RECOVERY_DECAY;
        } else if (sylRate > SYL_HEALTHY_HI) {
          s.driftY += dt * DRIFT_PACE_PER_S;
        } else {
          s.driftY -= dt * DRIFT_PACE_PER_S;
        }
      }

      s.driftX = clamp(s.driftX, -1, 1);
      s.driftY = clamp(s.driftY, -1, 1);

      const dist = Math.hypot(s.driftX, s.driftY);
      const score = Math.max(0, 1 - dist / Math.SQRT2);

      setState({
        targetX: s.driftX,
        targetY: s.driftY,
        strengthDb: dB,
        wpmEstimate: Math.round(wpm),
        score,
        isActive: true,
      });
    };

    s.raf = requestAnimationFrame(loop);
  }, []);

  const stop = useCallback(() => {
    const s = r.current;
    cancelAnimationFrame(s.raf);
    if (s.ctx) {
      s.ctx.close();
      s.ctx = null;
    }
    s.analyser = null;
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  return {
    targetX: state.targetX,
    targetY: state.targetY,
    strengthDb: state.strengthDb,
    wpmEstimate: state.wpmEstimate,
    score: state.score,
    isActive: state.isActive,
    start,
    stop,
  };
}
