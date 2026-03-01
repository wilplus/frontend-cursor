"use client";

/**
 * Sniper Wheel — Real-time metrics from live audio.
 * Computes: pace (WPM), pause stats, dynamic range, emphasis (filtered), energy by third.
 * Rolling 30s window; update every 2s. Energy only after 2+ min.
 */

import { useCallback, useRef, useState } from "react";
import { SyllableRateDetector } from "@/lib/audio/syllable-rate";
import type { MetricConfidence, SniperMetricState, SniperState } from "@/lib/sniper/types";
import { computeScores, computeOverallScore, getTierFromScore } from "@/lib/sniper/scoring";
import { getPrimaryCoachingCue } from "@/lib/sniper/coaching";
import { TIER_HYSTERESIS_UPDATES } from "@/lib/sniper/constants";

const TICK_MS = 50;
const FFT_SIZE = 4096;
const SUB_FRAMES = 2;
const SYL_PER_WORD = 1.4;
const VOICE_RMS = 0.006;
const WINDOW_SEC = 30;
const UPDATE_INTERVAL_MS = 2000;
const SAMPLE_INTERVAL_MS = 100;
const ENERGY_MIN_SESSION_SEC = 120;
const PAUSE_LONG_MS = 1500;
const EMPHASIS_BASELINE_SEC = 3;
const EMPHASIS_DB_ABOVE = 6;
/** Spec: ≥300 ms between emphasis events. */
const EMPHASIS_MIN_GAP_MS = 300;
const ROLLING_BASELINE_SAMPLES = Math.round((EMPHASIS_BASELINE_SEC * 1000) / SAMPLE_INTERVAL_MS);

/** 95th − 5th percentile of values (robust dynamic range). Returns 0 if insufficient data. */
function percentileRange(values: number[], pLo: number, pHi: number): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const iLo = Math.max(0, Math.floor((sorted.length - 1) * pLo));
  const iHi = Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * pHi));
  return sorted[iHi] - sorted[iLo];
}

interface Sample {
  t: number;
  rms: number;
  db: number;
  voiced: boolean;
}

function defaultMetricState(sessionDurationSec: number): SniperMetricState {
  return {
    paceWpm: 0,
    avgPauseMs: 0,
    longestPauseMs: 0,
    speechDensity: 0,
    dynamicRangeDb: 0,
    emphasisPerMin: 0,
    energyByThird: null,
    sessionDurationSec,
    confidence: {
      pace: "insufficient",
      pause: "insufficient",
      dynamic: "insufficient",
      emphasis: "insufficient",
      energy: "insufficient",
    },
  };
}

function defaultSniperState(): SniperState {
  return {
    metrics: defaultMetricState(0),
    scores: { pace: 70, pause: 70, dynamic: 70, emphasis: 70, energy: 70 },
    overallScore: 70,
    tier: "structured",
    coachingCue: "",
    coachingSegment: null,
    energyAvailable: false,
    isActive: false,
  };
}

export function useSniperMetrics(sessionStartTimeRef: { current: number | null }) {
  const [state, setState] = useState<SniperState>(defaultSniperState);

  const r = useRef({
    ctx: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    raf: 0,
    lastTick: 0,
    lastUpdate: 0,
    buf: null as Float32Array | null,
    syl: new SyllableRateDetector(SUB_FRAMES * (1000 / TICK_MS), 3),
    samples: [] as Sample[],
    sessionRmsSum: 0,
    sessionRmsCount: 0,
    tierCandidate: null as SniperState["tier"] | null,
    tierCandidateCount: 0,
    lastTier: "structured" as SniperState["tier"],
  });

  const start = useCallback((stream: MediaStream) => {
    const s = r.current;
    if (s.ctx) {
      cancelAnimationFrame(s.raf);
      s.ctx.close();
    }

    const ctx = new AudioContext();
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
    s.lastUpdate = performance.now();
    s.syl.reset();
    s.samples = [];
    s.sessionRmsSum = 0;
    s.sessionRmsCount = 0;
    s.tierCandidate = null;
    s.tierCandidateCount = 0;

    setState(defaultSniperState());

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const elapsed = now - s.lastTick;
      if (elapsed < TICK_MS) return;
      s.lastTick = now;

      if (!s.analyser || !s.buf || !s.ctx) return;
      if (s.ctx.state === "suspended") {
        s.ctx.resume();
        return;
      }

      s.analyser.getFloatTimeDomainData(s.buf as Float32Array<ArrayBuffer>);
      const len = s.buf.length;
      let sum = 0;
      for (let i = 0; i < len; i++) sum += s.buf[i] * s.buf[i];
      const rms = Math.sqrt(sum / len);
      const db = 20 * Math.log10(rms + 1e-8);
      const voiced = rms > VOICE_RMS;

      const fSz = (len / SUB_FRAMES) | 0;
      for (let f = 0; f < SUB_FRAMES; f++) {
        let fs = 0;
        const off = f * fSz;
        for (let i = 0; i < fSz; i++) fs += s.buf[off + i] * s.buf[off + i];
        s.syl.push(Math.sqrt(fs / fSz));
      }

      if (s.sessionRmsCount < 1e6) {
        s.sessionRmsSum += rms;
        s.sessionRmsCount += 1;
      }

      if (now - (s.samples[0]?.t ?? 0) >= SAMPLE_INTERVAL_MS || s.samples.length === 0) {
        s.samples.push({ t: now, rms, db, voiced });
        const maxSamples = (WINDOW_SEC * 1000) / SAMPLE_INTERVAL_MS;
        while (s.samples.length > maxSamples) s.samples.shift();
      }

      if (now - s.lastUpdate < UPDATE_INTERVAL_MS) return;
      s.lastUpdate = now;

      const sessionDurationSec = sessionStartTimeRef.current
        ? (now - sessionStartTimeRef.current) / 1000
        : 0;

      const samples = s.samples;
      const windowDurationSec = samples.length
        ? (samples[samples.length - 1].t - samples[0].t) / 1000
        : 0;
      if (windowDurationSec < 5) {
        setState((prev) => ({
          ...prev,
          metrics: defaultMetricState(sessionDurationSec),
          isActive: true,
        }));
        return;
      }

      const sylRate = s.syl.getRate();
      const paceWpm = sylRate * (60 / SYL_PER_WORD);

      const pauseLengths: number[] = [];
      let silenceStart: number | null = null;
      let voicedFrames = 0;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].voiced) {
          voicedFrames++;
          if (silenceStart !== null) {
            pauseLengths.push(samples[i].t - silenceStart);
            silenceStart = null;
          }
        } else {
          if (silenceStart === null) silenceStart = samples[i].t;
        }
      }
      const totalFrames = samples.length;
      const speechDensity = totalFrames > 0 ? voicedFrames / totalFrames : 0;
      const avgPauseMs =
        pauseLengths.length > 0
          ? pauseLengths.reduce((a, b) => a + b, 0) / pauseLengths.length
          : 0;
      const longestPauseMs = pauseLengths.length > 0 ? Math.max(...pauseLengths) : 0;
      const hasLongPauseInWindow = longestPauseMs >= PAUSE_LONG_MS;

      const voicedDbs = samples.filter((x) => x.voiced).map((x) => x.db);
      const dynamicRangeDb = percentileRange(voicedDbs, 0.05, 0.95);

      const baselineLen = Math.min(ROLLING_BASELINE_SAMPLES, samples.length - 1);
      let emphasisCount = 0;
      const minGapSamples = EMPHASIS_MIN_GAP_MS / SAMPLE_INTERVAL_MS;
      let lastEmphasisIdx = -minGapSamples - 1;
      for (let i = baselineLen; i < samples.length; i++) {
        const baseline =
          baselineLen > 0
            ? samples
                .slice(i - baselineLen, i)
                .reduce((a, x) => a + x.db, 0) / baselineLen
            : samples[i].db;
        if (
          samples[i].voiced &&
          samples[i].db >= baseline + EMPHASIS_DB_ABOVE &&
          i - lastEmphasisIdx >= minGapSamples
        ) {
          emphasisCount++;
          lastEmphasisIdx = i;
        }
      }
      const emphasisPerMin =
        windowDurationSec > 0 ? (emphasisCount / windowDurationSec) * 60 : 0;

      let energyByThird: SniperMetricState["energyByThird"] = null;
      if (sessionDurationSec >= ENERGY_MIN_SESSION_SEC && samples.length >= 3) {
        const third = Math.floor(samples.length / 3);
        const e1 =
          third > 0
            ? samples.slice(0, third).reduce((a, x) => a + x.rms, 0) / third
            : 0;
        const e2 =
          third > 0
            ? samples.slice(third, 2 * third).reduce((a, x) => a + x.rms, 0) / third
            : 0;
        const e3 =
          samples.length - 2 * third > 0
            ? samples
                .slice(2 * third)
                .reduce((a, x) => a + x.rms, 0) / (samples.length - 2 * third)
            : 0;
        const sessionMean =
          s.sessionRmsCount > 0 ? s.sessionRmsSum / s.sessionRmsCount : 1;
        const norm = (v: number) => (sessionMean > 1e-8 ? v / sessionMean : 0);
        energyByThird = {
          e1: norm(e1),
          e2: norm(e2),
          e3: norm(e3),
        };
      }

      const confidence: SniperMetricState["confidence"] = {
        pace: windowDurationSec >= 10 ? "high" : windowDurationSec >= 5 ? "low" : "insufficient",
        pause: totalFrames >= 30 ? "high" : totalFrames >= 10 ? "low" : "insufficient",
        dynamic: voicedDbs.length >= 20 ? "high" : voicedDbs.length >= 5 ? "low" : "insufficient",
        emphasis: windowDurationSec >= 15 ? "high" : windowDurationSec >= 5 ? "low" : "insufficient",
        energy:
          sessionDurationSec >= ENERGY_MIN_SESSION_SEC ? "high" : "insufficient",
      };

      const metrics: SniperMetricState = {
        paceWpm: Math.round(paceWpm),
        avgPauseMs: Math.round(avgPauseMs),
        longestPauseMs: Math.round(longestPauseMs),
        speechDensity,
        dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
        emphasisPerMin: Math.round(emphasisPerMin * 10) / 10,
        energyByThird,
        sessionDurationSec,
        confidence,
      };

      const energyAvailable =
        sessionDurationSec >= ENERGY_MIN_SESSION_SEC && energyByThird != null;
      const paceVarianceWpm = 0;
      const scores = computeScores(metrics, {
        hasLongPauseInWindow,
        paceVarianceWpm,
      });
      const overallScore = computeOverallScore(scores, energyAvailable);
      const newTier = getTierFromScore(overallScore);
      let tier = s.lastTier;
      if (s.tierCandidate === newTier) {
        s.tierCandidateCount++;
        if (s.tierCandidateCount >= TIER_HYSTERESIS_UPDATES) {
          tier = newTier;
          s.lastTier = newTier;
          s.tierCandidate = null;
          s.tierCandidateCount = 0;
        }
      } else {
        s.tierCandidate = newTier;
        s.tierCandidateCount = 1;
      }
      const { cue, segment } = getPrimaryCoachingCue(metrics, scores);
      s.lastTier = tier;

      setState({
        metrics,
        scores,
        overallScore: Math.round(overallScore),
        tier,
        coachingCue: cue,
        coachingSegment: segment,
        energyAvailable,
        isActive: true,
      });
    };

    s.raf = requestAnimationFrame(loop);
  }, [sessionStartTimeRef]);

  const stop = useCallback(() => {
    const s = r.current;
    cancelAnimationFrame(s.raf);
    if (s.ctx) {
      s.ctx.close();
      s.ctx = null;
    }
    s.analyser = null;
    setState((prev) => ({ ...prev, isActive: false }));
  }, []);

  return { ...state, start, stop };
}
