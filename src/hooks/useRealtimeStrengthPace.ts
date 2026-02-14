"use client";

/**
 * Real-time Strength (volume) + Pace feedback only.
 * Uses mic → AnalyserNode; 100ms loop → RMS/dB, voiced ratio → WPM, band scores + dual EMA.
 * Final score is computed after upload; this hook is for live UI only.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { bandScore } from "@/lib/audio/band-score";

const UPDATE_MS = 100;
/** Good band is [TARGET_DB - TOLERANCE_DB, TARGET_DB + TOLERANCE_DB]. Higher TARGET_DB = band shifted right (prefer slightly stronger voice). */
const TARGET_DB = -20;
const TOLERANCE_DB = 5;
const TARGET_WPM = 140;
/** Wider tolerance so "too fast" is less sensitive. */
const TOLERANCE_WPM = 48;
/** Voiced = speech; RMS > 0.015 (≈ -36 dB) to avoid treating noise as speech. */
const VOICED_RMS_THRESHOLD = 0.015;
const WINDOW_SAMPLES = 30; // 3 s at 100 ms
/** Dual EMA: fast (responsive) + slow (smooth). Strength blend 0.7 slow + 0.3 fast; return-to-center 0.85 slow + 0.15 fast. */
const EMA_STRENGTH_FAST = 0.28;
const EMA_STRENGTH_SLOW = 0.09;
/** Pace: 0.6 slow + 0.4 fast (lighter trend). */
const EMA_PACE_FAST = 0.2;
const EMA_PACE_SLOW = 0.08;
/** Raw strength on target above this → use return-to-center damping blend. */
const ON_TARGET_THRESHOLD = 0.85;
const WPM_MIN = 60;
const WPM_MAX = 220;

function rmsToDb(rms: number): number {
  return 20 * Math.log10(rms + 1e-8);
}

export interface UseRealtimeStrengthPaceResult {
  strengthScore: number;
  paceScore: number;
  strengthDb: number;
  wpmEstimate: number;
  /** -1 = quiet, 1 = loud (for ball x direction). */
  strengthDirection: number;
  /** -1 = slow, 1 = fast (for ball y direction). */
  paceDirection: number;
  isActive: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

export function useRealtimeStrengthPace(): UseRealtimeStrengthPaceResult {
  const [strengthScore, setStrengthScore] = useState(0.5);
  const [paceScore, setPaceScore] = useState(0.5);
  const [strengthDb, setStrengthDb] = useState(-60);
  const [wpmEstimate, setWpmEstimate] = useState(TARGET_WPM);
  const [strengthDirection, setStrengthDirection] = useState(0);
  const [paceDirection, setPaceDirection] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fastStrengthRef = useRef(0.5);
  const slowStrengthRef = useRef(0.5);
  const fastPaceRef = useRef(0.5);
  const slowPaceRef = useRef(0.5);
  const voicedWindowRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sourceRef.current && analyserRef.current) {
      try {
        sourceRef.current.disconnect(analyserRef.current);
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    voicedWindowRef.current = [];
    setIsActive(false);
    setStrengthScore(0.5);
    setPaceScore(0.5);
    setStrengthDb(-60);
    setWpmEstimate(TARGET_WPM);
    setStrengthDirection(0);
    setPaceDirection(0);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const start = useCallback((stream: MediaStream) => {
    if (!stream?.active) return;
    stop();
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioContextRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    analyserRef.current = analyser;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    voicedWindowRef.current = [];
    fastStrengthRef.current = 0.5;
    slowStrengthRef.current = 0.5;
    fastPaceRef.current = 0.5;
    slowPaceRef.current = 0.5;

    // Browsers start AudioContext suspended; resume and start interval. Only read analyser when
    // context is running (Chrome may keep it suspended until user gesture), and try resume() each tick so we pick up after a click.
    ctx.resume().then(() => {
      if (audioContextRef.current !== ctx) return;
      setIsActive(true);
      intervalRef.current = setInterval(() => {
        const ctxNow = audioContextRef.current;
        const a = analyserRef.current;
        if (!a || !ctxNow) return;
        if (ctxNow.state !== "running") {
          ctxNow.resume().catch(() => {});
          return;
        }
        a.getFloatTimeDomainData(dataArray);

        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const s = dataArray[i];
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const db = rmsToDb(rms);
        setStrengthDb(db);

        const voiced = rms > VOICED_RMS_THRESHOLD ? 1 : 0;
        const win = voicedWindowRef.current;
        win.push(voiced);
        if (win.length > WINDOW_SAMPLES) win.shift();
        const voicedRatio = win.length === 0 ? 0 : win.reduce((a, b) => a + b, 0) / win.length;
        const wpm = Math.max(WPM_MIN, Math.min(WPM_MAX, 60 + voicedRatio * 160));
        setWpmEstimate(wpm);

        let rawStrengthScore = bandScore(db, TARGET_DB, TOLERANCE_DB);
        if (db < TARGET_DB) {
          rawStrengthScore = 1 - (1 - rawStrengthScore) * 0.78;
        } else if (db > TARGET_DB) {
          rawStrengthScore = Math.max(0, 1 - (1 - rawStrengthScore) * 1.2);
        }
        const rawPaceScore = bandScore(wpm, TARGET_WPM, TOLERANCE_WPM);

        // Dual EMA for strength: fast + slow; return-to-center damping when raw is on target
        const fastStr = EMA_STRENGTH_FAST * rawStrengthScore + (1 - EMA_STRENGTH_FAST) * fastStrengthRef.current;
        const slowStr = EMA_STRENGTH_SLOW * rawStrengthScore + (1 - EMA_STRENGTH_SLOW) * slowStrengthRef.current;
        fastStrengthRef.current = fastStr;
        slowStrengthRef.current = slowStr;
        const returnToCenter = rawStrengthScore > ON_TARGET_THRESHOLD;
        const strengthBlend = returnToCenter ? 0.85 * slowStr + 0.15 * fastStr : 0.7 * slowStr + 0.3 * fastStr;
        setStrengthScore(strengthBlend);

        // Dual EMA for pace: 0.6 slow + 0.4 fast (lighter trend)
        const fastPace = EMA_PACE_FAST * rawPaceScore + (1 - EMA_PACE_FAST) * fastPaceRef.current;
        const slowPace = EMA_PACE_SLOW * rawPaceScore + (1 - EMA_PACE_SLOW) * slowPaceRef.current;
        fastPaceRef.current = fastPace;
        slowPaceRef.current = slowPace;
        const paceBlend = 0.6 * slowPace + 0.4 * fastPace;
        setPaceScore(paceBlend);

        setStrengthDirection(db < TARGET_DB ? -1 : 1);
        setPaceDirection(wpm < TARGET_WPM ? -1 : 1);
      }, UPDATE_MS);
    }).catch(() => {});
  }, [stop]);

  return {
    strengthScore,
    paceScore,
    strengthDb,
    wpmEstimate,
    strengthDirection,
    paceDirection,
    isActive,
    start,
    stop,
  };
}
