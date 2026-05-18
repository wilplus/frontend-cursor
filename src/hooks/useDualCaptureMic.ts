"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
      code: "no_support" | "denied" | "stream_failed";
    };

export interface DualCaptureMic {
  state: DualCaptureState;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => void;
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

export function useDualCaptureMic(opts?: { lang?: string }): DualCaptureMic {
  const lang = opts?.lang ?? "en-US";
  const [state, setState] = useState<DualCaptureState>({ status: "idle" });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const partialRef = useRef<string>("");
  const finalRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const mimeRef = useRef<string>("audio/webm");

  // teardown is the single source of truth for releasing the mic. Anything
  // calling start/stop/cancel ends up here. Defensive try/catch on each leg
  // because the underlying objects may already be torn down (e.g. user
  // cancelled mid-stop) — we never want one failed teardown leg to leak
  // the next one.
  const teardown = useCallback(() => {
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
    const Ctor = getSpeechRecognitionCtor();
    const mime = pickDualCaptureMimeType();
    if (!Ctor || !mime) {
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
        message: denied
          ? "Microphone permission denied."
          : "Couldn't access the microphone.",
      });
      return;
    }
    streamRef.current = stream;
    mimeRef.current = mime;
    startedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;

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

    recorder.start();
    try {
      recognition.start();
    } catch {
      // start() can throw "InvalidStateError" if already started; we
      // just attempted a fresh construct so this should be rare, but
      // tolerate it rather than poison the state.
    }

    setState({ status: "recording", partialText: "" });
  }, [lang, teardown]);

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

  return { state, start, stop, cancel };
}
