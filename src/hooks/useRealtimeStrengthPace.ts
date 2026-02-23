"use client";

/**
 * Real-time Strength (volume) + Pace feedback only.
 * Uses mic → AnalyserNode; 100ms loop → RMS/dB, voiced ratio → WPM, band scores + dual EMA.
 * Final score is computed after upload; this hook is for live UI only.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { bandScore } from "@/lib/audio/band-score";

/** Public speaking smooth: ~14 updates/sec reduces jitter. */
const UPDATE_MS = 70;
/** Good band is [TARGET_DB - TOLERANCE_DB, TARGET_DB + TOLERANCE_DB]. Higher TARGET_DB = band shifted right (prefer slightly stronger voice). */
const TARGET_DB = -20;
const TOLERANCE_DB = 5;
/** Public speaking: slightly faster target, wider tolerance for emphasis/pauses. */
const TARGET_WPM = 150;
const TOLERANCE_WPM = 60;
/** Pace direction hysteresis: avoid rapid flip around single WPM boundary. */
const PACE_FAST_THRESHOLD = TARGET_WPM + 5;
const PACE_SLOW_THRESHOLD = TARGET_WPM - 5;
/** Voiced = speech; RMS > 0.004 (≈ -48 dB) so typical mic levels trigger; avoids treating only loud speech as speech. */
const VOICED_RMS_THRESHOLD = 0.004;
const WINDOW_SAMPLES = 30; // 3 s at 100 ms
/** VAD for strength: silence = center. Consecutive frames above/below to confirm voice on/off. Typical speech RMS ~0.005–0.02. */
const VOICE_RMS_THRESHOLD = 0.005;
const VOICE_ON_MIN_FRAMES = 2;
const VOICE_OFF_MIN_FRAMES = 3;
/** Silence: gradual drift to neutral over ~800ms; never imply pause = mistake. */
const STRENGTH_CENTER_DRIFT_ALPHA = 0.04;
/** Pace: nonlinear compression so small expressive shifts don't cause visible tension. */
const PACE_ERROR_EXP = 1.4;
/** Dual EMA: slightly slower for calmer public speaking UX. */
const EMA_STRENGTH_FAST = 0.22;
const EMA_STRENGTH_SLOW = 0.06;
/** Pace: 0.6 slow + 0.4 fast (lighter trend). */
const EMA_PACE_FAST = 0.2;
const EMA_PACE_SLOW = 0.08;
/** Adaptive smoothing: when far off target, favor fast EMA for quicker response; when close, favor slow for calm. */
const ADAPTIVE_RAW_THRESHOLD = 0.85;
/** Pace display: slower smoothing for calm public speaking. */
const PACE_DISPLAY_EMA = 0.12;
const WPM_MIN = 60;
const WPM_MAX = 220;
const SILENCE_SETTLED_MS = 500;

function rmsToDb(rms: number): number {
  return 20 * Math.log10(rms + 1e-8);
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
  /** -1 = quiet, 1 = loud (for ball x direction). */
  strengthDirection: number;
  /** -1 = slow, 1 = fast (for ball y direction). */
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRealtimeStrengthPace.ts:start',message:'start(stream) called',data:{streamActive:!!stream?.active,hasTracks:!!stream?.getAudioTracks?.()?.length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
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

    // Browsers start AudioContext suspended; resume and start interval. Only read analyser when
    // context is running (Chrome may keep it suspended until user gesture), and try resume() each tick so we pick up after a click.
    ctx.resume().then(() => {
      if (audioContextRef.current !== ctx) return;
      setIsActive(true);
      setStrengthScore(1.0);
      setStrengthDirection(0);
      let tickCount = 0;
      intervalRef.current = setInterval(() => {
        tickCount += 1;
        const ctxNow = audioContextRef.current;
        const a = analyserRef.current;
        if (!a || !ctxNow) return;
        if (ctxNow.state !== "running") {
          // #region agent log
          if (tickCount <= 3 || tickCount % 30 === 0) fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRealtimeStrengthPace.ts:interval',message:'skip ctx not running',data:{state:ctxNow.state,tick:tickCount},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
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

        // VAD for strength: consecutive frames above/below threshold
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

        let strengthBlend: number;
        let strengthDir: number;
        if (voiceActiveRef.current) {
          let rawStrengthScore = bandScore(db, TARGET_DB, TOLERANCE_DB);
          if (db < TARGET_DB) {
            rawStrengthScore = 1 - (1 - rawStrengthScore) * 0.78;
          } else if (db > TARGET_DB) {
            rawStrengthScore = Math.max(0, 1 - (1 - rawStrengthScore) * 1.1);
          }
          const fastStr = EMA_STRENGTH_FAST * rawStrengthScore + (1 - EMA_STRENGTH_FAST) * fastStrengthRef.current;
          const slowStr = EMA_STRENGTH_SLOW * rawStrengthScore + (1 - EMA_STRENGTH_SLOW) * slowStrengthRef.current;
          fastStrengthRef.current = fastStr;
          slowStrengthRef.current = slowStr;
          // Adaptive: when far off (raw low), more fast EMA for quicker response; when close, calm 0.3 fast + 0.7 slow
          const strengthFastWeight = rawStrengthScore >= ADAPTIVE_RAW_THRESHOLD ? 0.3 : 0.5;
          let blend = strengthFastWeight * fastStr + (1 - strengthFastWeight) * slowStr;
          strengthBlend = 1 - Math.pow(1 - blend, 1.6);
          strengthDir = db < TARGET_DB ? -1 : 1;
        } else {
          const fastStr = (1 - STRENGTH_CENTER_DRIFT_ALPHA) * fastStrengthRef.current + STRENGTH_CENTER_DRIFT_ALPHA * 1.0;
          const slowStr = (1 - STRENGTH_CENTER_DRIFT_ALPHA) * slowStrengthRef.current + STRENGTH_CENTER_DRIFT_ALPHA * 1.0;
          fastStrengthRef.current = fastStr;
          slowStrengthRef.current = slowStr;
          const blend = 0.3 * fastStr + 0.7 * slowStr;
          strengthBlend = 1 - Math.pow(1 - blend, 1.6);
          strengthDir = 0;
        }
        setStrengthScore(strengthBlend);
        setStrengthDirection(strengthDir);

        // Dual EMA for pace; adaptive: when far off, more fast for quicker response
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
        // #region agent log
        if (tickCount <= 5 || tickCount % 25 === 0) fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRealtimeStrengthPace.ts:interval',message:'updated strength/pace',data:{tick:tickCount,rms,db,strengthBlend,paceScore:displayPaceRef.current,voiceActive:voiceActiveRef.current},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
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
