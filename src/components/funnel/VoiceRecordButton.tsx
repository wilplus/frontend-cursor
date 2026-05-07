"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "idle" | "recording";

/**
 * VoiceRecordButton — Willab Chat funnel record control.
 *
 * Two visual states only — `idle` (mic) and `recording` (red Stop with
 * a pulsing halo). The previous "recorded" preview state is gone: the
 * moment the user stops, the audio is submitted automatically. The UX
 * is strictly **tap to start → tap to stop → upload runs in background**
 * with no Send button. The parent renders the user's audio bubble + the
 * typing indicator instantly to mask network latency.
 */
interface VoiceRecordButtonProps {
  /**
   * Auto-submit. Fires the moment the recording stops, with the raw
   * blob and rounded-down duration in seconds. The parent kicks off
   * the upload + next-question fetch.
   */
  onSend: (blob: Blob, durationSeconds: number) => void | Promise<void>;
  /** Fires when capture begins (mic acquired, recorder.start()). */
  onStart?: () => void;
  /**
   * Fires alongside onSend with a playable Object URL so the parent
   * can immediately render the user's audio bubble in the chat thread.
   */
  onRecorded?: (audioUrl: string, durationSeconds: number) => void;
  /** Disables the entire control (e.g. while a chunked reply is rendering). */
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

export default function VoiceRecordButton({
  onSend,
  onStart,
  onRecorded,
  disabled = false,
  className,
}: VoiceRecordButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Cleanup on unmount: release mic so we don't leave the indicator on.
  useEffect(() => {
    return () => {
      stopTicker();
      releaseStream();
    };
  }, [releaseStream, stopTicker]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
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

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // onstop is the auto-submit hook — build blob, hand it to the parent
      // (which renders the user bubble + typing dots immediately and
      // starts the background upload). No preview / Send button.
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const seconds = Math.floor(
          (Date.now() - startedAtRef.current) / 1000
        );
        releaseStream();
        // Reset to idle right away — the parent gates re-display via its
        // own state (loadingQuestion / currentQuestion) so the mic won't
        // actually flash back into view until the chunked reply finishes.
        setState("idle");
        setElapsed(0);
        onRecorded?.(url, seconds);
        void onSend(blob, seconds);
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
  }, [disabled, onRecorded, onSend, onStart, releaseStream, stopTicker]);

  const stopRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state === "inactive") return;
    stopTicker();
    r.stop(); // triggers recorder.onstop above → fires onRecorded + onSend
  }, [stopTicker]);

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

      {state === "recording" && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(elapsed)}
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
