"use client";

/**
 * Real-time strength (volume) + pace (syllable rate) feedback.
 *
 * Outputs signed ball positions (targetX, targetY) in [-1, +1]:
 *   targetX: −1 too quiet … 0 on target … +1 too loud
 *   targetY: −1 too slow  … 0 on target … +1 too fast
 *
 * Pipeline:
 *   mic → HP 80Hz + HS 2kHz → analyser
 *   → RMS → dB → signed distance from target → 1€ filter → deadzone → targetX
 *   → sub-frame RMS → syllable peaks → rate → signed distance → 1€ filter → deadzone → targetY
 */

import { useCallback, useRef, useState } from "react";
import { OneEuroFilter } from "@/lib/audio/one-euro-filter";
import { SyllableRateDetector } from "@/lib/audio/syllable-rate";

/* ─── constants ──────────────────────────────────────────────── */

// strength (perceptual loudness): wider tolerance = ball centered more often
const TARGET_DB = -20;
const DB_TOLERANCE = 10;

// pace (syllable rate → WPM): wider tolerance = less leaning
const TARGET_SYL = 3.5;     // syl/s ≈ 150 WPM
const SYL_TOLERANCE = 2.0;  // ±2 syl/s ≈ ±85 WPM
const SYL_PER_WORD = 1.4;

// timing
const TICK_MS = 50;          // 20 Hz
const FFT_SIZE = 4096;
const SUB_FRAMES = 2;        // → 40 Hz envelope

// voice activity: center ball quickly on pause so it doesn’t lean outside
const VOICE_RMS = 0.006;
const SILENCE_GRACE_MS = 350;

// 1€ filter tuning
const STR_MIN_CUT = 0.8;
const STR_BETA = 0.004;
const PACE_MIN_CUT = 0.4;
const PACE_BETA = 0.002;

// display: wider deadzone = ball stays centered unless clearly off target
const DEADZONE = 0.14;

/* ─── types ──────────────────────────────────────────────────── */

export interface UseRealtimeStrengthPaceResult {
  /** Signed ball X: −1 too quiet … 0 perfect … +1 too loud */
  targetX: number;
  /** Signed ball Y: −1 too slow … 0 perfect … +1 too fast */
  targetY: number;
  /** Raw dB for UI display */
  strengthDb: number;
  /** Estimated WPM for UI display */
  wpmEstimate: number;
  /** Composite score 0–1 (1 = on target) */
  score: number;
  isActive: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

/* ─── helpers ────────────────────────────────────────────────── */

/** Continuous deadzone: values below zone smoothly snap to 0, no discontinuity. */
function deadzone(v: number, z: number): number {
  const a = Math.abs(v);
  if (a < z) return 0;
  return Math.sign(v) * (a - z) / (1 - z);
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
  });

  const start = useCallback((stream: MediaStream) => {
    const s = r.current;

    // tear down previous
    if (s.ctx) {
      cancelAnimationFrame(s.raf);
      s.ctx.close();
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);

    // K-weight-inspired filter chain
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

    setState(prev => ({ ...prev, isActive: true }));

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - s.lastTick < TICK_MS) return;
      s.lastTick = now;

      if (!s.analyser || !s.buf || !s.ctx) return;
      if (s.ctx.state === "suspended") { s.ctx.resume(); return; }

      s.analyser.getFloatTimeDomainData(s.buf as Float32Array<ArrayBuffer>);

      // ── overall RMS → dB ──
      let sum = 0;
      const d = s.buf;
      const len = d.length;
      for (let i = 0; i < len; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / len);
      const dB = 20 * Math.log10(rms + 1e-8);

      // ── sub-frame RMS → syllable detector ──
      const fSz = (len / SUB_FRAMES) | 0;
      for (let f = 0; f < SUB_FRAMES; f++) {
        let fs = 0;
        const off = f * fSz;
        for (let i = 0; i < fSz; i++) fs += d[off + i] * d[off + i];
        s.syl.push(Math.sqrt(fs / fSz));
      }
      const sylRate = s.syl.getRate();
      const wpm = sylRate * (60 / SYL_PER_WORD);

      // ── VAD ──
      const voiced = rms > VOICE_RMS;
      if (voiced) s.lastVoice = now;
      const silenceMs = now - s.lastVoice;

      // ── signed distance from target ──
      let rawStr: number;
      if (dB < -50) {
        rawStr = 0; // no meaningful signal yet
      } else {
        rawStr = Math.max(-1, Math.min(1, (dB - TARGET_DB) / DB_TOLERANCE));
      }

      let rawPace: number;
      if (sylRate <= 0) {
        rawPace = 0; // not enough data yet
      } else {
        rawPace = Math.max(-1, Math.min(1, (sylRate - TARGET_SYL) / SYL_TOLERANCE));
      }

      // ── silence = center lock (A2: grounded, intentional) ──
      if (silenceMs > SILENCE_GRACE_MS) {
        const t = now / 1000;
        s.strF.filter(0, t);
        s.paceF.filter(0, t);
        setState({
          targetX: 0,
          targetY: 0,
          strengthDb: dB,
          wpmEstimate: Math.round(wpm),
          score: 1,
          isActive: true,
        });
        return;
      }

      // ── 1€ adaptive smoothing ──
      const t = now / 1000;
      let sx = s.strF.filter(rawStr, t);
      let sy = s.paceF.filter(rawPace, t);

      // ── continuous deadzone ──
      let x = deadzone(sx, DEADZONE);
      let y = deadzone(sy, DEADZONE);

      // ── composite score ──
      const dist = Math.hypot(x, y);
      const score = Math.max(0, 1 - dist / Math.SQRT2);

      // kill micro drift: near-perfect = exact center (Apple removes unnecessary motion)
      if (score > 0.94) {
        x = 0;
        y = 0;
      }

      setState({
        targetX: x,
        targetY: y,
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
    if (s.ctx) { s.ctx.close(); s.ctx = null; }
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
