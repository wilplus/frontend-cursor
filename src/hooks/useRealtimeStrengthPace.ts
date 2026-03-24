"use client";

/**
 * Real-time metric field for the homework recorder.
 * Step 1 keeps the current strength + pace behavior.
 * Step 2 swaps the X-axis to baseline-relative pitch while preserving the same
 * smoothing and spring-driven feel.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { detectPitchHz, hzToSemitones } from "@/lib/audio/pitch-detector";
import { LEVEL_1_STEP_1 } from "@/lib/realtime-levels";
import type { RealtimeTrainingStep } from "@/lib/realtime-levels";

const UPDATE_MS = 100;
/** Minimum score on both axes to count as "in the center zone" for center-hold accumulation. */
const CENTER_HOLD_THRESHOLD = 0.4;
const TARGET_DB = -16;
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
// Horizontal (strength axis) asymmetry: lower factor = more forgiving.
// Keep opposite-side preference from current behavior (quiet side preferred).
const STRENGTH_QUIET_BIAS_FACTOR = 0.3;
const STRENGTH_LOUD_BIAS_FACTOR = 0.9;
const WPM_MIN = 60;
const WPM_MAX = 220;
const SILENCE_SETTLED_MS = 500;
const PITCH_TOLERANCE_ST = 3;
const PITCH_DIRECTION_DEADZONE_ST = 0.35;
const PITCH_MIN_FRAMES_FOR_BOOTSTRAP = 12;
const PITCH_CENTER_DRIFT_ALPHA = 0.05;
const EMA_PITCH_FAST = 0.18;
const EMA_PITCH_SLOW = 0.06;
const PITCH_DISPLAY_EMA = 0.12;

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
  activeStep?: RealtimeTrainingStep;
  pitchBaselineSt?: number | null;
}

export interface UseRealtimeStrengthPaceResult {
  xScore: number;
  yScore: number;
  xDirection: number;
  yDirection: number;
  strengthScore: number;
  paceScore: number;
  strengthDb: number;
  wpmEstimate: number;
  strengthDirection: number;
  paceDirection: number;
  pitchCenterSt: number | null;
  pitchDeltaSt: number | null;
  pitchFrameCount: number;
  activeStep: RealtimeTrainingStep;
  isActive: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
  /** Returns accumulated center-hold data for the current/last recording session. */
  getSessionCenterHold: () => { centerHoldRatio: number | null; centerHoldMs: number; totalActiveMs: number };
}

export function useRealtimeStrengthPace(options?: UseRealtimeStrengthPaceOptions): UseRealtimeStrengthPaceResult {
  const [xScore, setXScore] = useState(0.5);
  const [yScore, setYScore] = useState(0.5);
  const [xDirection, setXDirection] = useState(0);
  const [yDirection, setYDirection] = useState(0);
  const [strengthScore, setStrengthScore] = useState(0.5);
  const [paceScore, setPaceScore] = useState(0.5);
  const [strengthDb, setStrengthDb] = useState(-60);
  const [wpmEstimate, setWpmEstimate] = useState(TARGET_WPM);
  const [strengthDirection, setStrengthDirection] = useState(0);
  const [paceDirection, setPaceDirection] = useState(0);
  const [pitchCenterSt, setPitchCenterSt] = useState<number | null>(null);
  const [pitchDeltaSt, setPitchDeltaSt] = useState<number | null>(null);
  const [pitchFrameCount, setPitchFrameCount] = useState(0);
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
  const fastPitchRef = useRef(1.0);
  const slowPitchRef = useRef(1.0);
  const displayPitchRef = useRef(1.0);
  const voicedWindowRef = useRef<number[]>([]);
  const voiceActiveRef = useRef(false);
  const voiceAboveCountRef = useRef(0);
  const voiceBelowCountRef = useRef(0);
  const paceDirectionRef = useRef(0);
  const sessionPitchMeanStRef = useRef<number | null>(null);
  const sessionPitchFrameCountRef = useRef(0);
  const silenceSettledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Accumulated center-hold: voiced frames where both strength + pace >= CENTER_HOLD_THRESHOLD. */
  const centerHoldFramesRef = useRef(0);
  /** Total voiced frames (voice active) for the session. */
  const totalVoicedFramesRef = useRef(0);
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
    fastPitchRef.current = 1.0;
    slowPitchRef.current = 1.0;
    displayPitchRef.current = 1.0;
    sessionPitchMeanStRef.current = null;
    sessionPitchFrameCountRef.current = 0;
    centerHoldFramesRef.current = 0;
    totalVoicedFramesRef.current = 0;
    setIsActive(false);
    setXScore(0.5);
    setYScore(0.5);
    setXDirection(0);
    setYDirection(0);
    setStrengthScore(0.5);
    setPaceScore(0.5);
    setStrengthDb(-60);
    setWpmEstimate(TARGET_WPM);
    setStrengthDirection(0);
    paceDirectionRef.current = 0;
    setPaceDirection(0);
    setPitchCenterSt(null);
    setPitchDeltaSt(null);
    setPitchFrameCount(0);
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
    fastPitchRef.current = 1.0;
    slowPitchRef.current = 1.0;
    displayPitchRef.current = 1.0;
    voiceActiveRef.current = false;
    voiceAboveCountRef.current = 0;
    voiceBelowCountRef.current = 0;
    sessionPitchMeanStRef.current = null;
    sessionPitchFrameCountRef.current = 0;

    ctx.resume().then(() => {
      if (audioContextRef.current !== ctx) return;
      const activeStep = optionsRef.current?.activeStep ?? LEVEL_1_STEP_1;
      setIsActive(true);
      setXScore(1.0);
      setYScore(0.5);
      setXDirection(0);
      setYDirection(0);
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
        let detectedPitchSt: number | null = null;
        if (voiceActiveRef.current) {
          const pitchHz = detectPitchHz(dataArray, ctxNow.sampleRate);
          if (pitchHz !== null) {
            detectedPitchSt = hzToSemitones(pitchHz);
            sessionPitchFrameCountRef.current += 1;
            const prevMean = sessionPitchMeanStRef.current;
            sessionPitchMeanStRef.current =
              prevMean === null
                ? detectedPitchSt
                : prevMean + (detectedPitchSt - prevMean) / sessionPitchFrameCountRef.current;
          }
        }
        setPitchCenterSt(sessionPitchMeanStRef.current);
        setPitchFrameCount(sessionPitchFrameCountRef.current);

        let nextStrengthScore: number;
        let nextStrengthDirection: number;
        if (voiceActiveRef.current) {
          let rawStrengthScore = bandScore(db, TARGET_DB, TOLERANCE_DB);
          // Asymmetric horizontal bias: strongly prefer quieter side over louder side.
          if (db < TARGET_DB) rawStrengthScore = 1 - (1 - rawStrengthScore) * STRENGTH_QUIET_BIAS_FACTOR;
          else if (db > TARGET_DB) rawStrengthScore = Math.max(0, 1 - (1 - rawStrengthScore) * STRENGTH_LOUD_BIAS_FACTOR);
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

        // ── Center-hold accumulation ───────────────────────────────────────────
        if (voiceActiveRef.current) {
          totalVoicedFramesRef.current += 1;
          if (nextStrengthScore >= CENTER_HOLD_THRESHOLD && displayPaceRef.current >= CENTER_HOLD_THRESHOLD) {
            centerHoldFramesRef.current += 1;
          }
        }

        let nextPaceDir = paceDirectionRef.current;
        if (wpm > PACE_FAST_THRESHOLD) nextPaceDir = 1;
        else if (wpm < PACE_SLOW_THRESHOLD) nextPaceDir = -1;
        paceDirectionRef.current = nextPaceDir;
        setPaceDirection(nextPaceDir);
        setYScore(displayPaceRef.current);
        setYDirection(nextPaceDir);

        const configuredBaseline = optionsRef.current?.pitchBaselineSt;
        const hasStoredBaseline =
          typeof configuredBaseline === "number" && Number.isFinite(configuredBaseline);
        const bootstrappedBaselineReady =
          sessionPitchFrameCountRef.current >= PITCH_MIN_FRAMES_FOR_BOOTSTRAP &&
          sessionPitchMeanStRef.current != null;
        const activePitchBaseline =
          hasStoredBaseline
            ? configuredBaseline!
            : bootstrappedBaselineReady
              ? sessionPitchMeanStRef.current
              : null;

        let nextPitchScore = displayPitchRef.current;
        let nextPitchDirection = 0;
        let nextPitchDeltaSt: number | null = null;
        if (voiceActiveRef.current && detectedPitchSt != null && activePitchBaseline != null) {
          nextPitchDeltaSt = detectedPitchSt - activePitchBaseline;
          const rawPitchScore = bandScore(detectedPitchSt, activePitchBaseline, PITCH_TOLERANCE_ST);
          const fastPitch = EMA_PITCH_FAST * rawPitchScore + (1 - EMA_PITCH_FAST) * fastPitchRef.current;
          const slowPitch = EMA_PITCH_SLOW * rawPitchScore + (1 - EMA_PITCH_SLOW) * slowPitchRef.current;
          fastPitchRef.current = fastPitch;
          slowPitchRef.current = slowPitch;
          const pitchBlend = 0.45 * fastPitch + 0.55 * slowPitch;
          const displayPitchRaw = 1 - Math.pow(Math.max(0, 1 - pitchBlend), 1.35);
          displayPitchRef.current =
            PITCH_DISPLAY_EMA * displayPitchRaw + (1 - PITCH_DISPLAY_EMA) * displayPitchRef.current;
          nextPitchScore = displayPitchRef.current;
          if (nextPitchDeltaSt > PITCH_DIRECTION_DEADZONE_ST) nextPitchDirection = 1;
          else if (nextPitchDeltaSt < -PITCH_DIRECTION_DEADZONE_ST) nextPitchDirection = -1;
        } else {
          const fastPitch =
            (1 - PITCH_CENTER_DRIFT_ALPHA) * fastPitchRef.current + PITCH_CENTER_DRIFT_ALPHA * 1.0;
          const slowPitch =
            (1 - PITCH_CENTER_DRIFT_ALPHA) * slowPitchRef.current + PITCH_CENTER_DRIFT_ALPHA * 1.0;
          fastPitchRef.current = fastPitch;
          slowPitchRef.current = slowPitch;
          const pitchBlend = 0.35 * fastPitch + 0.65 * slowPitch;
          displayPitchRef.current =
            PITCH_DISPLAY_EMA * pitchBlend + (1 - PITCH_DISPLAY_EMA) * displayPitchRef.current;
          nextPitchScore = displayPitchRef.current;
        }
        setPitchDeltaSt(nextPitchDeltaSt);

        const xMetric = (optionsRef.current?.activeStep ?? activeStep).xAxis.metric;
        const resolvedXScore = xMetric === "pitch_baseline" ? nextPitchScore : nextStrengthScore;
        const resolvedXDirection =
          xMetric === "pitch_baseline" ? nextPitchDirection : nextStrengthDirection;
        setXScore(resolvedXScore);
        setXDirection(resolvedXDirection);
      }, UPDATE_MS);
    }).catch(() => {});
  }, [stop]);

  const getSessionCenterHold = useCallback(() => {
    const total = totalVoicedFramesRef.current;
    const center = centerHoldFramesRef.current;
    return {
      totalActiveMs: total * UPDATE_MS,
      centerHoldMs: center * UPDATE_MS,
      centerHoldRatio: total > 0 ? center / total : null,
    };
  }, []);

  return {
    xScore,
    yScore,
    xDirection,
    yDirection,
    strengthScore,
    paceScore,
    strengthDb,
    wpmEstimate,
    strengthDirection,
    paceDirection,
    pitchCenterSt,
    pitchDeltaSt,
    pitchFrameCount,
    activeStep: options?.activeStep ?? LEVEL_1_STEP_1,
    isActive,
    start,
    stop,
    getSessionCenterHold,
  };
}
