"use client";

/**
 * Real-time Strength (volume) + Pace feedback.
 * Uses mic -> AnalyserNode; 100ms loop -> RMS/dB, voiced ratio -> WPM,
 * band scores + dual EMA.
 */
import { useState, useCallback, useRef, useEffect } from "react";

const UPDATE_MS = 100;
const TARGET_DB = -18;
const TOLERANCE_DB = 5;
const TARGET_WPM = 165;
const TOLERANCE_WPM = 60;
const PACE_FAST_THRESHOLD = TARGET_WPM + 5;
const PACE_SLOW_THRESHOLD = TARGET_WPM - 5;
const VOICED_RMS_THRESHOLD = 0.004;
const WINDOW_SAMPLES = 30;
const VOICE_RMS_THRESHOLD = 0.005;
const VOICE_ON_MIN_FRAMES = 2;
const VOICE_OFF_MIN_FRAMES = 3;
const STRENGTH_CENTER_DRIFT_ALPHA = 0.04;
const PACE_ERROR_EXP = 1.4;
const EMA_STRENGTH_FAST = 0.28;
const EMA_STRENGTH_SLOW = 0.09;
const EMA_PACE_FAST = 0.14;
const EMA_PACE_SLOW = 0.05;
const ADAPTIVE_RAW_THRESHOLD = 0.85;
const PACE_DISPLAY_EMA = 0.08;
const WPM_MIN = 60;
const WPM_MAX = 220;
const SILENCE_SETTLED_MS = 500;

function rmsToDb(rms: number): number {
  return 20 * Math.log10(rms + 1e-8);
}

function bandScore(value: number, target: number, tolerance: number): number {
  const error = Math.abs(value - target);
  if (error >= tolerance) return 0;
  return 1 - error / tolerance;
}

export interface UseRealtimeStrengthPaceOptions {
  onVoiceDrop?: () => void;
  onSilenceSettled?: () => void;
}

export interface UseRealtimeStrengthPaceResult {
  strengthScore: number;
  paceScore: number;
  strengthDb: number;
  wpmEstimate: number;
  strengthDirection: number;
  paceDirection: number;
  isActive: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

export function useRealtimeStrengthPace(options?: UseRealtimeStrengthPaceOptions): UseRealtimeStrengthPaceResult {
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
  const displayPaceRef = useRef(0.5);
  const voicedWindowRef = useRef<number[]>([]);
  const voiceActiveRef = useRef(false);
  const voiceAboveCountRef = useRef(0);
  const voiceBelowCountRef = useRef(0);
  const paceDirectionRef = useRef(0);
  const silenceSettledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback(() => {
    if (silenceSettledTimeoutRef.current) {
      clearTimeout(silenceSettledTimeoutRef.current);
      silenceSettledTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sourceRef.current && analyserRef.current) {
      try {
        sourceRef.current.disconnect(analyserRef.current);
      } catch {}
      sourceRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    voicedWindowRef.current = [];
    voiceActiveRef.current = false;
    voiceAboveCountRef.current = 0;
    voiceBelowCountRef.current = 0;
    fastStrengthRef.current = 1.0;
    slowStrengthRef.current = 1.0;
    displayPaceRef.current = 0.5;
    setIsActive(false);
    setStrengthScore(0.5);
    setPaceScore(0.5);
    setStrengthDb(-60);
    setWpmEstimate(TARGET_WPM);
    setStrengthDirection(0);
    paceDirectionRef.current = 0;
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
    fastStrengthRef.current = 1.0;
    slowStrengthRef.current = 1.0;
    fastPaceRef.current = 0.5;
    slowPaceRef.current = 0.5;
    displayPaceRef.current = 0.5;
    voiceActiveRef.current = false;
    voiceAboveCountRef.current = 0;
    voiceBelowCountRef.current = 0;

    ctx.resume().then(() => {
      if (audioContextRef.current !== ctx) return;
      setIsActive(true);
      setStrengthScore(1.0);
      setStrengthDirection(0);
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

        const above = rms >= VOICE_RMS_THRESHOLD;
        if (above) {
          voiceAboveCountRef.current += 1;
          voiceBelowCountRef.current = 0;
        } else {
          voiceBelowCountRef.current += 1;
          voiceAboveCountRef.current = 0;
        }
        const wasVoiceActive = voiceActiveRef.current;
        if (!voiceActiveRef.current && voiceAboveCountRef.current >= VOICE_ON_MIN_FRAMES) {
          if (silenceSettledTimeoutRef.current) {
            clearTimeout(silenceSettledTimeoutRef.current);
            silenceSettledTimeoutRef.current = null;
          }
          voiceActiveRef.current = true;
        }
        if (voiceActiveRef.current && voiceBelowCountRef.current >= VOICE_OFF_MIN_FRAMES) {
          voiceActiveRef.current = false;
          if (wasVoiceActive) {
            optionsRef.current?.onVoiceDrop?.();
            silenceSettledTimeoutRef.current = setTimeout(() => {
              silenceSettledTimeoutRef.current = null;
              optionsRef.current?.onSilenceSettled?.();
            }, SILENCE_SETTLED_MS);
          }
        }

        const voiced = rms > VOICED_RMS_THRESHOLD ? 1 : 0;
        const win = voicedWindowRef.current;
        win.push(voiced);
        if (win.length > WINDOW_SAMPLES) win.shift();
        const voicedRatio = win.length === 0 ? 0 : win.reduce((a, b) => a + b, 0) / win.length;
        const wpm = Math.max(WPM_MIN, Math.min(WPM_MAX, 60 + voicedRatio * 160));
        setWpmEstimate(wpm);

        const rawPaceScore = bandScore(wpm, TARGET_WPM, TOLERANCE_WPM);

        let nextStrengthScore: number;
        let nextStrengthDirection: number;
        if (voiceActiveRef.current) {
          let rawStrengthScore = bandScore(db, TARGET_DB, TOLERANCE_DB);
          if (db < TARGET_DB) rawStrengthScore = 1 - (1 - rawStrengthScore) * 0.78;
          else if (db > TARGET_DB) rawStrengthScore = Math.max(0, 1 - (1 - rawStrengthScore) * 0.45);
          const fastStr = EMA_STRENGTH_FAST * rawStrengthScore + (1 - EMA_STRENGTH_FAST) * fastStrengthRef.current;
          const slowStr = EMA_STRENGTH_SLOW * rawStrengthScore + (1 - EMA_STRENGTH_SLOW) * slowStrengthRef.current;
          fastStrengthRef.current = fastStr;
          slowStrengthRef.current = slowStr;
          const strengthFastWeight = rawStrengthScore >= ADAPTIVE_RAW_THRESHOLD ? 0.3 : 0.5;
          const blend = strengthFastWeight * fastStr + (1 - strengthFastWeight) * slowStr;
          nextStrengthScore = 1 - Math.pow(1 - blend, 1.6);
          nextStrengthDirection = db < TARGET_DB ? -1 : 1;
        } else {
          const fastStr = (1 - STRENGTH_CENTER_DRIFT_ALPHA) * fastStrengthRef.current + STRENGTH_CENTER_DRIFT_ALPHA * 1.0;
          const slowStr = (1 - STRENGTH_CENTER_DRIFT_ALPHA) * slowStrengthRef.current + STRENGTH_CENTER_DRIFT_ALPHA * 1.0;
          fastStrengthRef.current = fastStr;
          slowStrengthRef.current = slowStr;
          const blend = 0.3 * fastStr + 0.7 * slowStr;
          nextStrengthScore = 1 - Math.pow(1 - blend, 1.6);
          nextStrengthDirection = 0;
        }
        setStrengthScore(nextStrengthScore);
        setStrengthDirection(nextStrengthDirection);

        const fastPace = EMA_PACE_FAST * rawPaceScore + (1 - EMA_PACE_FAST) * fastPaceRef.current;
        const slowPace = EMA_PACE_SLOW * rawPaceScore + (1 - EMA_PACE_SLOW) * slowPaceRef.current;
        fastPaceRef.current = fastPace;
        slowPaceRef.current = slowPace;
        const isFast = wpm >= TARGET_WPM;
        const paceFastWeight = isFast ? 0.2 : (rawPaceScore >= ADAPTIVE_RAW_THRESHOLD ? 0.4 : 0.55);
        const paceBlend = (1 - paceFastWeight) * slowPace + paceFastWeight * fastPace;
        const paceError = Math.pow(Math.max(0, 1 - paceBlend), PACE_ERROR_EXP);
        const displayPaceRaw = 1 - paceError;
        displayPaceRef.current = PACE_DISPLAY_EMA * displayPaceRaw + (1 - PACE_DISPLAY_EMA) * displayPaceRef.current;
        setPaceScore(displayPaceRef.current);

        let nextPaceDir = paceDirectionRef.current;
        if (wpm > PACE_FAST_THRESHOLD) nextPaceDir = 1;
        else if (wpm < PACE_SLOW_THRESHOLD) nextPaceDir = -1;
        paceDirectionRef.current = nextPaceDir;
        setPaceDirection(nextPaceDir);
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
