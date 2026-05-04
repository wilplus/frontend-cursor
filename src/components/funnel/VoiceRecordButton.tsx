"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "idle" | "recording" | "recorded";

interface VoiceRecordButtonProps {
  /**
   * Called when the user taps the Send icon after recording. Receives the raw
   * audio blob and the recorded duration in seconds (rounded down). The parent
   * is responsible for upload + routing.
   */
  onSend: (blob: Blob, durationSeconds: number) => void | Promise<void>;
  /** Fired when the mic is acquired and capture begins. */
  onStart?: () => void;
  /**
   * Optional minimum duration enforcement. Send is disabled until reached;
   * the recorded chip surfaces the gap so the user knows why.
   */
  minDurationSeconds?: number;
  /** External "in flight" flag — disables Send while parent uploads. */
  uploading?: boolean;
  /** Disables the entire control. */
  disabled?: boolean;
  className?: string;
}

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * VoiceRecordButton — Willab Chat funnel record control.
 *
 * Owns MediaRecorder + state machine. Three visual states:
 *   - idle:      single round mic button (primary)
 *   - recording: same button shown red with `animate-pulse-ring` halo + Stop icon
 *   - recorded:  inline player + Redo + Send
 *
 * The parent handles upload + routing via `onSend`.
 */
export default function VoiceRecordButton({
  onSend,
  onStart,
  minDurationSeconds,
  uploading = false,
  disabled = false,
  className,
}: VoiceRecordButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalDurationRef = useRef<number>(0);

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Cleanup on unmount: release mic + revoke object URL so we don't leak.
  useEffect(() => {
    return () => {
      stopTicker();
      releaseStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || uploading) return;
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      blobRef.current = null;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        setState("recorded");
        releaseStream();
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      stopTicker();
      tickRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
      setState("recording");
      onStart?.();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Microphone access denied: ${err.message}`
          : "Microphone access denied."
      );
      releaseStream();
    }
  }, [audioUrl, disabled, releaseStream, stopTicker, uploading]);

  const stopRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state === "inactive") return;
    finalDurationRef.current = (Date.now() - startedAtRef.current) / 1000;
    setElapsed(finalDurationRef.current);
    stopTicker();
    r.stop();
  }, [stopTicker]);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    finalDurationRef.current = 0;
    setElapsed(0);
    setState("idle");
  }, [audioUrl]);

  const handleSend = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    const seconds = Math.floor(finalDurationRef.current || elapsed);
    void onSend(blob, seconds);
  }, [elapsed, onSend]);

  const sendDisabled =
    uploading ||
    !blobRef.current ||
    (typeof minDurationSeconds === "number" &&
      finalDurationRef.current < minDurationSeconds);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {state === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          aria-label="Start recording"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mic className="h-8 w-8" aria-hidden />
        </button>
      )}

      {state === "recording" && (
        <div className="relative">
          <span
            className="absolute inset-0 rounded-full bg-recording-pulse animate-pulse-ring"
            aria-hidden
          />
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-recording-pulse text-white shadow-lg transition-transform hover:scale-105"
          >
            <Square className="h-7 w-7 fill-current" aria-hidden />
          </button>
        </div>
      )}

      {state === "recorded" && audioUrl && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex w-full items-center justify-between">
            <button
              type="button"
              onClick={resetRecording}
              disabled={uploading}
              aria-label="Re-record"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Redo
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendDisabled}
              aria-label="Send recording"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {uploading ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {(state === "recording" || state === "recorded") && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(elapsed)}
          {typeof minDurationSeconds === "number" &&
            finalDurationRef.current > 0 &&
            finalDurationRef.current < minDurationSeconds && (
              <span className="ml-2 text-recording-pulse">
                (min {minDurationSeconds}s — please record a bit more)
              </span>
            )}
        </p>
      )}

      {errorMessage && (
        <p className="text-center text-xs text-recording-pulse">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
