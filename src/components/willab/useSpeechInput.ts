"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useSpeechInput — Lounge voice input via the Web Speech API (§3)            */
/*                                                                            */
/*  Local, free, browser-native speech-to-text for the LOUNGE chat — the        */
/*  text-or-speech choice (functionally identical, both unmeasured). This is     */
/*  NOT the Whisper pipeline (that's the Lab's MediaRecorder upload).           */
/*                                                                            */
/*  Mic ownership (§3 / §4): when `enabled` is false — i.e. the Lab overlay is   */
/*  open — any in-flight recognition is released so only the Lab's MediaRecorder  */
/*  holds the mic; it resumes when the overlay closes. `supported` is false on    */
/*  browsers without the API (the caller then hides the mic button).            */
/* -------------------------------------------------------------------------- */

interface SpeechResultAlt {
  transcript: string;
}
interface SpeechResult {
  0: SpeechResultAlt;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechInput {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
}

export function useSpeechInput({
  enabled,
  onTranscript,
}: {
  enabled: boolean;
  onTranscript: (text: string) => void;
}): UseSpeechInput {
  const [supported] = useState(() => getCtor() != null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-subscribing the recognition handlers.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* stop() throws if not started — ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";
    rec.continuous = false;
    rec.interimResults = false; // final transcript only — append to the draft
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onTranscriptRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Mic ownership: release the moment the Lab overlay opens (enabled → false).
  useEffect(() => {
    if (!enabled && listening) stop();
  }, [enabled, listening, stop]);

  // Release on unmount (defensive — the Lounge is always-mounted in practice).
  useEffect(() => () => stop(), [stop]);

  return { supported, listening: enabled && listening, toggle };
}
