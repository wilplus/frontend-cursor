"use client";

/**
 * Live Coach — flow-only real-time metrics.
 * Tracks voiced/silent from PCM (via WebAudio EnergyVAD) over a rolling 30 s window.
 * Computes pause_ratio, flow_score, performance_score, flow_offset, coach_color.
 * Smooths score with IIR filter. No WPM, no dynamic, no emphasis, no pitch.
 *
 * When live WPM is added (X-WPM header): plug in scoreFlow + scorePace → combineScores
 * and set paceOffset from WPM deviation. Everything else stays unchanged.
 */

import { useCallback, useRef, useState } from "react";
import { EnergyVAD } from "@/lib/audio/vad";
import type { LiveCoachState } from "@/lib/sniper/types";
import {
  scoreFlow,
  computeFlowOffset,
  computePerformanceScore,
  getCoachColor,
} from "@/lib/sniper/scoring";
import { getFlowCoachingCue } from "@/lib/sniper/coaching";
import { SMOOTH_ALPHA } from "@/lib/sniper/constants";

const TICK_MS = 50;
const FFT_SIZE = 4096;
const WINDOW_SEC = 30;
const SAMPLE_INTERVAL_MS = 100;
const UPDATE_INTERVAL_MS = 2000;
/** Minimum window before we start scoring (avoids noisy first read). */
const MIN_WINDOW_SEC = 5;
/** Voiced ratio below this → silence gate (return gray). */
const VOICED_RATIO_GATE = 0.06;

interface Sample {
  t: number;
  voiced: boolean;
}

function defaultState(): LiveCoachState {
  return {
    performanceScore: 0,
    flowScore: null,
    flowOffset: 0,
    paceOffset: 0,
    coachColor: "gray",
    pauseRatio: 0,
    silenceGated: true,
    coachingCue: "Speak to start…",
    isActive: false,
  };
}

export function useSniperMetrics(_sessionStartTimeRef: { current: number | null }) {
  const [state, setState] = useState<LiveCoachState>(defaultState);
  const [audioError, setAudioError] = useState(false);

  const r = useRef({
    ctx: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    raf: 0,
    lastTick: 0,
    lastUpdate: 0,
    buf: null as Float32Array | null,
    bufFreq: null as Float32Array | null,
    vad: new EnergyVAD(),
    samples: [] as Sample[],
    smoothedScore: null as number | null,
    audioError: false,
    voicedTotal: 0,
    totalFrames: 0,
  });

  const start = useCallback((stream: MediaStream) => {
    const s = r.current;
    if (s.ctx) {
      cancelAnimationFrame(s.raf);
      s.ctx.close();
    }

    const trackSampleRate = stream.getAudioTracks()[0]?.getSettings().sampleRate;
    const ctx = new AudioContext(trackSampleRate ? { sampleRate: trackSampleRate } : undefined);

    const audioTrack = stream.getAudioTracks()[0];
    const onTrackEnded = () => {
      if (!s.audioError) {
        s.audioError = true;
        setAudioError(true);
      }
    };
    audioTrack?.addEventListener("ended", onTrackEnded);
    audioTrack?.addEventListener("mute", onTrackEnded);

    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    hp.Q.value = 0.707;
    const an = ctx.createAnalyser();
    an.fftSize = FFT_SIZE;
    an.smoothingTimeConstant = 0;
    src.connect(hp).connect(an);

    s.ctx = ctx;
    s.analyser = an;
    s.buf = new Float32Array(FFT_SIZE);
    s.bufFreq = new Float32Array(FFT_SIZE / 2);
    s.vad.reset();
    s.lastTick = performance.now();
    s.lastUpdate = performance.now();
    s.samples = [];
    s.smoothedScore = null;
    s.audioError = false;
    s.voicedTotal = 0;
    s.totalFrames = 0;

    setState(defaultState());
    setAudioError(false);

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - s.lastTick < TICK_MS) return;
      s.lastTick = now;

      if (!s.analyser || !s.buf || !s.bufFreq || !s.ctx) return;
      if (s.ctx.state === "suspended") {
        s.ctx.resume();
        return;
      }

      s.analyser.getFloatTimeDomainData(s.buf as Float32Array<ArrayBuffer>);
      s.analyser.getFloatFrequencyData(s.bufFreq as Float32Array<ArrayBuffer>);

      const { isSpeaking } = s.vad.process(
        s.bufFreq as Float32Array,
        s.buf as Float32Array,
        s.ctx.sampleRate,
        FFT_SIZE,
      );

      s.totalFrames++;
      if (isSpeaking) s.voicedTotal++;

      if (now - (s.samples[0]?.t ?? 0) >= SAMPLE_INTERVAL_MS || s.samples.length === 0) {
        s.samples.push({ t: now, voiced: isSpeaking });
        const maxSamples = (WINDOW_SEC * 1000) / SAMPLE_INTERVAL_MS;
        while (s.samples.length > maxSamples) s.samples.shift();
      }

      if (now - s.lastUpdate < UPDATE_INTERVAL_MS) return;
      s.lastUpdate = now;

      const samples = s.samples;
      const windowDurationSec = samples.length
        ? (samples[samples.length - 1].t - samples[0].t) / 1000
        : 0;

      if (windowDurationSec < MIN_WINDOW_SEC) {
        setState((prev) => ({ ...prev, isActive: true }));
        return;
      }

      const totalSamples = samples.length;
      const silentSamples = samples.filter((x) => !x.voiced).length;
      const voicedSamples = totalSamples - silentSamples;
      const voicedRatio = totalSamples > 0 ? voicedSamples / totalSamples : 0;
      const silenceGated = voicedRatio < VOICED_RATIO_GATE;

      const pauseRatio = totalSamples > 0 ? silentSamples / totalSamples : 0;

      let flowScore: number | null = null;
      let performanceScore: number = s.smoothedScore ?? 0;
      let flowOffset = 0;
      let paceOffset = 0;
      let coachColor = getCoachColor(null);

      if (!silenceGated) {
        flowScore = scoreFlow(pauseRatio);
        const rawPerf = computePerformanceScore(flowScore) ?? flowScore;
        // IIR smooth
        s.smoothedScore =
          s.smoothedScore === null
            ? rawPerf
            : s.smoothedScore * (1 - SMOOTH_ALPHA) + rawPerf * SMOOTH_ALPHA;
        performanceScore = Math.round(s.smoothedScore);
        flowOffset = computeFlowOffset(pauseRatio);
        coachColor = getCoachColor(performanceScore);
      } else {
        s.smoothedScore = null;
      }

      const voicedDurationSec = (s.voicedTotal / s.totalFrames) * (s.totalFrames * TICK_MS / 1000);
      void voicedDurationSec; // used externally via snapshot

      const coachingCue = getFlowCoachingCue(pauseRatio, silenceGated);

      setState({
        performanceScore,
        flowScore,
        flowOffset,
        paceOffset,
        coachColor,
        pauseRatio,
        silenceGated,
        coachingCue,
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
    setState((prev) => ({ ...prev, isActive: false }));
  }, []);

  /**
   * Snapshot for session end — capture current state for Review Summary and backend.
   * voicedDurationSec estimated from running voiced/total frame ratio × elapsed.
   */
  const getSnapshot = useCallback(() => {
    const s = r.current;
    const voicedFraction = s.totalFrames > 0 ? s.voicedTotal / s.totalFrames : 0;
    const elapsedSec = s.totalFrames * (TICK_MS / 1000);
    return {
      performanceScore: state.performanceScore,
      pauseRatio: state.pauseRatio,
      voicedDurationSec: Math.round(voicedFraction * elapsedSec),
    };
  }, [state.performanceScore, state.pauseRatio]);

  return { ...state, audioError, start, stop, getSnapshot };
}
