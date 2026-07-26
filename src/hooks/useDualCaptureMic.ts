"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function deniedMessage(): string {
  if (isPwaStandalone() && isIos()) {
    return "Microphone blocked. Open iPhone Settings, find WillpowerLab, and turn on Microphone.";
  }
  return "Microphone permission denied.";
}

/**
 * getUserMedia is genuinely absent on this device. Feature-detected (NOT
 * version-sniffed) so only truly-incapable clients are diverted: the classic
 * case is an iOS < 14.3 home-screen PWA, where standalone mode exposed no
 * getUserMedia at all. We keep `display: standalone` for everyone and route
 * just these clients to Safari (see the `needs_safari` error code), rather
 * than downgrading the whole app to browser chrome.
 */
function captureUnavailable(): boolean {
  if (typeof navigator === "undefined") return true;
  return typeof navigator.mediaDevices?.getUserMedia !== "function";
}

/* -------------------------------------------------------------------------- */
/*  useDualCaptureMic — Web Speech + MediaRecorder, single stream             */
/*                                                                            */
/*  Why dual capture? The Lounge (post-signup Q&A chat) is voice-enabled    */
/*  via Web Speech for visible transcript feedback, but we also need the     */
/*  raw audio for silent acoustic metrics (stress-contrast etc). Running    */
/*  two MediaStreams would double the mic-indicator weight and risk         */
/*  permission-prompt confusion; instead we open ONE getUserMedia and      */
/*  hand its stream to BOTH MediaRecorder and SpeechRecognition.            */
/*                                                                            */
/*  Spec — FE Prompt 3 in the BE/FE stress-contrast series. Backend BE-3   */
/*  is the consumer of the `audio_file` multipart field; the JSON path     */
/*  (no audio) keeps working unchanged per the compatibility contract       */
/*  (C1 in the prompt).                                                     */
/*                                                                            */
/*  Teardown contract (C5 in the prompt): on stop / cancel / unmount we    */
/*  recognition.stop(), mediaRecorder.stop(), AND                          */
/*  stream.getTracks().forEach(t => t.stop()). The third line is the one  */
/*  that makes the browser's mic-in-use indicator disappear; the first    */
/*  two only flush the consumers.                                          */
/* -------------------------------------------------------------------------- */

export type DualCaptureState =
  | { status: "idle" }
  | { status: "recording"; partialText: string }
  | {
      status: "stopped";
      finalText: string;
      audioBlob: Blob;
      durationSec: number;
    }
  | {
      status: "error";
      message: string;
      code: "no_support" | "denied" | "stream_failed" | "needs_safari";
    };

export interface DualCaptureMic {
  state: DualCaptureState;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
  /** F1 — monotonic timestamp of the recorder's `start` event, or null if it
   *  has not fired. Audio t=0: the caller measures its slide-tap clock against
   *  this so taps can be converted to audio time. A getter rather than state,
   *  so reading it never re-renders the recording screen. */
  getAudioStartedAt: () => number | null;
}

/* ---- Minimal Web Speech typings (TS lacks them out of the box) ---------- */
interface SpeechRecognitionAlt {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlt;
}
interface SpeechRecognitionResultsList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultsList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Pick the MediaRecorder mimeType the backend's ffmpeg pipeline expects
 * (per the prompt's C3 — `services/audio_metrics.py` accepts webm/opus
 * cleanly). Prefer the explicit opus codec; fall back to plain audio/webm
 * if the browser doesn't expose the codec hint. Returns null when even
 * audio/webm isn't supported — caller should hide the mic affordance
 * entirely in that case.
 */
export function pickDualCaptureMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

/**
 * Feature-detection helper used by the chat input bar to decide whether
 * to render the mic affordance at all (prompt C2). Returns true only
 * when BOTH the Web Speech API AND a usable MediaRecorder mimeType are
 * available — there's no point showing the mic if either half of the
 * dual capture would fail.
 */
export function isDualCaptureSupported(): boolean {
  return getSpeechRecognitionCtor() !== null && pickDualCaptureMimeType() !== null;
}

export function useDualCaptureMic(opts?: {
  lang?: string;
  /** Run Web Speech for a live transcript (default true). The Lab sets this
   *  false: it transcribes server-side (Whisper) and never shows the live
   *  transcript, so per-result recognition events would only churn re-renders
   *  (and rebuild a growing transcript string) for nothing — which made the
   *  recording screen progressively stale on long takes. Audio is unaffected. */
  transcript?: boolean;
}): DualCaptureMic {
  const lang = opts?.lang ?? "en-US";
  const wantTranscript = opts?.transcript ?? true;
  const [state, setState] = useState<DualCaptureState>({ status: "idle" });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const partialRef = useRef<string>("");
  const finalRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  /** F1 — when the RECORDER actually began capturing, on the same monotonic
   *  clock as startedAtRef. MediaRecorder warms up for tens to low-hundreds
   *  of ms after start() returns, so audio time runs behind UI time; the Lab
   *  measures that gap and sends it so slide taps land in audio time. null
   *  until the start event fires (and again on every fresh take). */
  const audioStartedAtRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  // Re-entrancy latch (T2). start() awaits getUserMedia; a second tap during
  // that async gap would fire a concurrent start() whose teardown() rips out
  // the first start's half-built recorder — leaving a recorder that exists
  // but can't stop (the "Stop button dies after a too-short re-record" bug).
  // One in-flight start at a time; cleared in a finally so the latch can
  // never stick (success, early-return, or throw) and jam the mic.
  const startingRef = useRef(false);
  // Generation token for the getUserMedia async gap (C5). start() awaits the
  // permission prompt; if the Lab is closed (cancel / unmount) during that gap,
  // teardown() can't release a stream that doesn't exist yet, and nothing runs
  // again once getUserMedia resolves — leaving a hot mic until reload. Every
  // teardown bumps this; start() snapshots it before the await and, if it moved
  // by the time the stream arrives, stops that just-granted stream and bails
  // instead of starting a recorder on a dead instance.
  const startGenRef = useRef(0);

  // teardown is the single source of truth for releasing the mic. Anything
  // calling start/stop/cancel ends up here. Defensive try/catch on each leg
  // because the underlying objects may already be torn down (e.g. user
  // cancelled mid-stop) — we never want one failed teardown leg to leak
  // the next one.
  const teardown = useCallback(() => {
    // Invalidate any in-flight start() (see startGenRef): a teardown during the
    // getUserMedia gap must abort the pending start so it can't leave a hot mic.
    startGenRef.current += 1;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {
        /* ignore — already stopped */
      }
      recognitionRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      recorderRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    // One in-flight start at a time (T2). See `startingRef` above.
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // No getUserMedia at all on this device (the iOS < 14.3 standalone-PWA
      // case). Don't attempt — on iOS surface a Safari escape hatch (the
      // `needs_safari` code drives an "Open in Safari" button) instead of a
      // dead error; elsewhere it's just an unsupported browser.
      if (captureUnavailable()) {
        const onIos = isIos();
        setState({
          status: "error",
          code: onIos ? "needs_safari" : "no_support",
          message: onIos
            ? "Recording isn't available here. Open WillpowerLab in Safari to record."
            : "Voice capture isn't supported in this browser.",
        });
        return;
      }

      // The Lab (transcript:false) needs only MediaRecorder; Web Speech is
      // optional there, so don't fail when the browser lacks it (e.g. Firefox).
      const Ctor = wantTranscript ? getSpeechRecognitionCtor() : null;
      const mime = pickDualCaptureMimeType();
      if (!mime || (wantTranscript && !Ctor)) {
        setState({
          status: "error",
          code: "no_support",
          message: "Voice capture isn't supported in this browser.",
        });
        return;
      }

      // Ensure any previous session is fully released before starting a
      // new one. Idempotent — no-ops on a clean state.
      teardown();
      chunksRef.current = [];
      partialRef.current = "";
      finalRef.current = "";
      // Snapshot AFTER our own teardown bump; a later teardown (cancel / unmount
      // while the permission prompt is up) moves it and aborts this start.
      const gen = startGenRef.current;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const name =
          err instanceof Error ? `${err.name} ${err.message}` : String(err);
        const denied = /NotAllowed|Permission|denied/i.test(name);
        setState({
          status: "error",
          code: denied ? "denied" : "stream_failed",
          message: denied ? deniedMessage() : "Couldn't access the microphone.",
        });
        return;
      }
      // The Lab was closed while the permission prompt was up (cancel /
      // unmount bumped the generation): release the just-granted stream and
      // bail — never start a recorder on a torn-down instance. State was
      // already reset by cancel()/unmount, so we don't touch it here.
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
        return;
      }
      streamRef.current = stream;
      mimeRef.current = mime;
      startedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      // A retake must never inherit the previous take's audio anchor.
      audioStartedAtRef.current = null;

      // Cap the bitrate so a normal-length recording stays under the upload
      // route's request-body ceiling: the BFF buffers the body and Vercel
      // serverless functions cap a request at ~4.5 MB. The browser default
      // (~128 kbps ≈ 1 MB/min) blows past that after ~4 min and the upload 413s.
      // 48 kbps opus mono is ample for the acoustic read (pitch / rate / pauses
      // / loudness) and keeps a ~12 min take under the limit.
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 48_000,
      });
      // Fires when capture actually starts, which is what audio t=0 means.
      // Not first-chunk timing: start() is called without a timeslice, so
      // ondataavailable only fires once, at stop.
      recorder.onstart = () => {
        audioStartedAtRef.current =
          typeof performance !== "undefined" ? performance.now() : Date.now();
      };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;

      if (Ctor) {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          // The contract is "transcript visible to the user IS what gets
          // sent" (C4). We accumulate finalised segments in finalRef and
          // expose finalRef + current interim as the live partialText.
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0]?.transcript ?? "";
            if (result.isFinal) {
              finalRef.current = `${finalRef.current} ${text}`.trim();
            } else {
              interim += text;
            }
          }
          partialRef.current = interim;
          const composite = `${finalRef.current} ${interim}`.trim();
          setState({ status: "recording", partialText: composite });
        };
        recognition.onerror = () => {
          // "no-speech", "audio-capture", "network" etc. are common and
          // shouldn't kill the recording — the user might still be mid-
          // sentence. We let MediaRecorder keep going; if Web Speech
          // permanently dies the user can still send the recorded audio
          // and the backend will transcribe via Whisper as a fallback.
        };
        recognition.onend = () => {
          // Don't auto-restart — `continuous: true` is best-effort and
          // some browsers (Safari) end the session unilaterally. Leaving
          // this as a no-op preserves whatever finalRef has captured so
          // stop() can still compose a clean transcript.
        };
        recognitionRef.current = recognition;
      }

      recorder.start();
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.start();
        } catch {
          // start() can throw "InvalidStateError" if already started; we
          // just attempted a fresh construct so this should be rare, but
          // tolerate it rather than poison the state.
        }
      }

      setState({ status: "recording", partialText: "" });
    } finally {
      // Cleared on every exit — success, early-return, or an unexpected
      // throw from MediaRecorder construction — so the latch never sticks.
      startingRef.current = false;
    }
  }, [lang, teardown, wantTranscript]);

  const stop = useCallback(async () => {
    // No-op if not actively recording — callers may invoke stop()
    // defensively (route change, blur) and we shouldn't change state.
    if (!recorderRef.current && !recognitionRef.current) return;

    // Stop recognition first to flush any pending final result. We
    // race against a 400ms safety bound so a stuck recognition end
    // event doesn't block the send.
    const recognition = recognitionRef.current;
    if (recognition) {
      await new Promise<void>((resolve) => {
        const safetyTimer = setTimeout(resolve, 400);
        recognition.onend = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        try {
          recognition.stop();
        } catch {
          clearTimeout(safetyTimer);
          resolve();
        }
      });
    }

    // Stop recorder and wait for the final ondataavailable event.
    const recorder = recorderRef.current;
    if (recorder) {
      await new Promise<void>((resolve) => {
        const safetyTimer = setTimeout(resolve, 600);
        recorder.onstop = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        try {
          if (recorder.state !== "inactive") recorder.stop();
          else resolve();
        } catch {
          clearTimeout(safetyTimer);
          resolve();
        }
      });
    }

    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const durationSec = (now - startedAtRef.current) / 1000;
    const finalText = `${finalRef.current} ${partialRef.current}`.trim();

    // Release the stream now that the blob is composed. Per C5 this
    // is the line that makes the OS-level mic indicator disappear.
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
    recorderRef.current = null;
    recognitionRef.current = null;

    setState({ status: "stopped", finalText, audioBlob: blob, durationSec });
  }, []);

  const cancel = useCallback(() => {
    teardown();
    chunksRef.current = [];
    partialRef.current = "";
    finalRef.current = "";
    setState({ status: "idle" });
  }, [teardown]);

  // Unmount / route-change safety net — final guarantee that the OS mic
  // indicator clears even if a parent component forgot to call cancel().
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  /** Monotonic timestamp of the recorder's start event, or null if it never
   *  fired. A getter, not state: reading it must not re-render the recorder. */
  const getAudioStartedAt = useCallback(() => audioStartedAtRef.current, []);

  return { state, start, stop, cancel, getAudioStartedAt };
}
