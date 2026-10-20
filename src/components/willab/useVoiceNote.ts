"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useVoiceNote — the Lounge mic for the founder's voice notebook (Will       */
/*  learning plan, step 1; founder 2026-10-20: "exactly like WhatsApp").       */
/*                                                                            */
/*  Tap the mic: it records. Trash throws it away, the arrow sends it. It      */
/*  stops and sends by itself at the limit (five minutes). Low bitrate, so a   */
/*  full note stays far under the upload limit. Not the official recording:   */
/*  nothing here touches a Take.                                              */
/* -------------------------------------------------------------------------- */

export type VoiceNotePhase = "idle" | "recording" | "sending";

const BITRATE = 32_000;

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

export function useVoiceNote({
  maxSeconds,
  onDone,
}: {
  maxSeconds: number;
  /** The finished recording; resolves when it is sent (or failed). */
  onDone: (audio: Blob, durationMs: number) => Promise<void>;
}) {
  const [phase, setPhase] = useState<VoiceNotePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const keepRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stopTicking = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const stop = useCallback((keep: boolean) => {
    keepRef.current = keep;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (phase !== "idle" || startingRef.current || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      startingRef.current = false;
      return; // no mic permission: nothing changes on screen
    }
    const release = () => stream.getTracks().forEach((t) => t.stop());
    startingRef.current = false;
    if (!mountedRef.current) {
      release(); // the Lounge closed while the browser asked for the mic
      return;
    }
    const mimeType = pickType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: BITRATE,
      });
    } catch {
      release(); // a browser that cannot record this format: the mic goes off
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopTicking();
      release();
      recorderRef.current = null;
      const duration = Date.now() - startedRef.current;
      const audio = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (!keepRef.current || !audio.size) {
        setPhase("idle");
        return;
      }
      setPhase("sending");
      void onDoneRef.current(audio, duration).finally(() => setPhase("idle"));
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    setElapsedMs(0);
    recorder.start(1000);
    setPhase("recording");
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedRef.current;
      setElapsedMs(ms);
      if (ms >= maxSeconds * 1000) stop(true);
    }, 250);
  }, [phase, maxSeconds, stop]);

  // Leaving the Lounge mid-note throws it away and frees the mic.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop(false);
    };
  }, [stop]);

  return {
    phase,
    elapsedMs,
    start,
    send: () => stop(true),
    cancel: () => stop(false),
  };
}

/** m:ss for the running note. */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
