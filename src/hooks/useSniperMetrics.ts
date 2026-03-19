"use client";

/**
 * Live Coach — 2D real-time metrics.
 *
 * Flow  (Y-axis): pause_ratio over a 5 s rolling window of VAD samples.
 * Pace  (X-axis): syllable-onset WPM over a 5 s rolling window.
 *   Each silent→voiced transition ≈ one syllable onset.
 *   wpm = (onsets_in_window / PACE_WINDOW_SEC) × 60 / AVG_SYLLABLES_PER_WORD
 *
 * Live score:    fast IIR blend (0.65*prev + 0.35*raw) → drives ball + coach color.
 * Session score: credit integral sqrt(live/100)*dt → drives displayed % + final report.
 *   Accumulated only while speaking; silence halts (not resets) accumulation.
 */

import { useCallback, useRef, useState } from "react";
import { EnergyVAD } from "@/lib/audio/vad";
import type { LiveCoachState } from "@/lib/sniper/types";
import {
  scoreFlow,
  scorePace,
  computeFlowOffset,
  computePaceOffset,
  getCoachColor,
} from "@/lib/sniper/scoring";
import { getCoachingCue } from "@/lib/sniper/coaching";
import {
  PACE_WINDOW_SEC,
  AVG_SYLLABLES_PER_WORD,
  PACE_MIN_ONSETS,
} from "@/lib/sniper/constants";

const TICK_MS = 50;
const FFT_SIZE = 4096;
const WINDOW_SEC = 5;
const SAMPLE_INTERVAL_MS = 100;
const UPDATE_INTERVAL_MS = 500;
/** Minimum window before we start scoring (avoids noisy first read). */
const MIN_WINDOW_SEC = 2;
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
    wpm: null,
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
    // ── Dual-score state ─────────────────────────────────────────────────────
    /** Fast IIR-smoothed live score (0–100). Drives ball position and coach color. */
    displayLiveScore: null as number | null,
    /** Accumulated speaking-time credits. Session score = 100 * earned / possible. */
    earnedPoints: 0,
    possiblePoints: 0,
    // ── Audio error tracking ─────────────────────────────────────────────────
    audioError: false,
    voicedTotal: 0,
    totalFrames: 0,
    // ── Pace: syllable-onset tracking ────────────────────────────────────────
    prevVoiced: false,
    onsets: [] as number[],   // timestamps (ms) of silent→voiced transitions
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
    s.displayLiveScore = null;
    s.earnedPoints = 0;
    s.possiblePoints = 0;
    s.audioError = false;
    s.voicedTotal = 0;
    s.totalFrames = 0;
    s.prevVoiced = false;
    s.onsets = [];

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

      // ── Flow samples ──────────────────────────────────────────────────────
      if (s.samples.length === 0 || now - s.samples[s.samples.length - 1].t >= SAMPLE_INTERVAL_MS) {
        s.samples.push({ t: now, voiced: isSpeaking });
        const maxSamples = (WINDOW_SEC * 1000) / SAMPLE_INTERVAL_MS;
        while (s.samples.length > maxSamples) s.samples.shift();
      }

      // ── Pace: onset detection (silent → voiced transition) ────────────────
      if (isSpeaking && !s.prevVoiced) {
        s.onsets.push(now);
      }
      s.prevVoiced = isSpeaking;

      // Prune onsets outside the 5 s window continuously
      const paceWindowMs = PACE_WINDOW_SEC * 1000;
      while (s.onsets.length > 0 && now - s.onsets[0] > paceWindowMs) {
        s.onsets.shift();
      }

      // ── State update every 500 ms ─────────────────────────────────────────
      if (now - s.lastUpdate < UPDATE_INTERVAL_MS) return;
      const dt = Math.min((now - s.lastUpdate) / 1000, 2); // seconds, capped at 2 s
      s.lastUpdate = now;

      const samples = s.samples;
      const windowDurationSec = samples.length
        ? (samples[samples.length - 1].t - samples[0].t) / 1000
        : 0;

      if (windowDurationSec < MIN_WINDOW_SEC) {
        setState((prev) => ({ ...prev, isActive: true }));
        return;
      }

      // ── Flow ──────────────────────────────────────────────────────────────
      const totalSamples = samples.length;
      const silentSamples = samples.filter((x) => !x.voiced).length;
      const voicedSamples = totalSamples - silentSamples;
      const voicedRatio = totalSamples > 0 ? voicedSamples / totalSamples : 0;
      const silenceGated = voicedRatio < VOICED_RATIO_GATE;

      const pauseRatio = totalSamples > 0 ? silentSamples / totalSamples : 0;

      // ── Pace: WPM from onset count in rolling 5 s window ──────────────────
      // wpm = (onsets / window_sec) × 60 / avg_syllables_per_word
      const wpm =
        s.onsets.length >= PACE_MIN_ONSETS
          ? (s.onsets.length / PACE_WINDOW_SEC) * 60 / AVG_SYLLABLES_PER_WORD
          : null;

      // ── Scoring ───────────────────────────────────────────────────────────
      let flowScore: number | null = null;
      let paceScore: number | null = null;
      let flowOffset = 0;
      let paceOffset = 0;

      if (!silenceGated) {
        flowScore = scoreFlow(pauseRatio);
        paceScore = wpm !== null ? scorePace(wpm) : null;

        // ── Live score: fast IIR (drives ball + coach color) ─────────────────
        const rawLive = paceScore !== null
          ? 0.6 * paceScore + 0.4 * flowScore
          : flowScore;
        s.displayLiveScore =
          s.displayLiveScore === null
            ? rawLive
            : 0.65 * s.displayLiveScore + 0.35 * rawLive;

        // ── Session accumulation: credited with sqrt curve (forgiving) ────────
        // Only accumulates while speaking — silence halts but does not erase.
        const credited = Math.sqrt(s.displayLiveScore / 100);
        s.earnedPoints += credited * dt;
        s.possiblePoints += dt;

        flowOffset = computeFlowOffset(pauseRatio);
        paceOffset = wpm !== null ? computePaceOffset(wpm) : 0;
      }
      // Silence: displayLiveScore kept (ball stays); earnedPoints/possiblePoints unchanged

      // Session score: time-weighted average over speaking time only
      const performanceScore =
        s.possiblePoints > 0
          ? Math.round(100 * s.earnedPoints / s.possiblePoints)
          : 0;

      // Coach color derived from LIVE score (fast-reacting), not session score
      const coachColor = getCoachColor(
        s.displayLiveScore !== null && !silenceGated ? s.displayLiveScore : null
      );

      const coachingCue = getCoachingCue(pauseRatio, silenceGated, wpm);

      setState({
        performanceScore,
        flowScore,
        flowOffset,
        paceOffset,
        wpm,
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
   */
  const getSnapshot = useCallback(() => {
    const s = r.current;
    const voicedFraction = s.totalFrames > 0 ? s.voicedTotal / s.totalFrames : 0;
    const elapsedSec = s.totalFrames * (TICK_MS / 1000);
    return {
      performanceScore: state.performanceScore,
      pauseRatio: state.pauseRatio,
      voicedDurationSec: Math.round(voicedFraction * elapsedSec),
      wpm: state.wpm,
    };
  }, [state.performanceScore, state.pauseRatio, state.wpm]);

  return { ...state, audioError, start, stop, getSnapshot };
}
