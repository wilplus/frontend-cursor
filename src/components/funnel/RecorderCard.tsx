"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";
import { Button } from "@/components/ui/button";

const MAX_DURATION_SECONDS = 15;
const MAX_BLOB_BYTES = 5 * 1024 * 1024;
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
];

function detectSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function micErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone was blocked. Click the lock icon in your address bar to allow it, then try again.";
  }
  if (name === "NotFoundError") {
    return "No microphone found. Connect a mic and try again.";
  }
  return "Microphone could not be accessed. Check your browser settings and try again.";
}

interface RecorderCardProps {
  /** Fired when recording stops (either by user or by 15-second cap). */
  onComplete: (blob: Blob, durationSeconds: number) => void;
  /** Disables the controls (e.g. while parent is uploading). */
  disabled?: boolean;
}

export default function RecorderCard({ onComplete, disabled = false }: RecorderCardProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [waveformLevel, setWaveformLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startMsRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const mime = detectSupportedMimeType();
    mimeTypeRef.current = mime;
    setIsSupported(mime !== null);
  }, []);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWaveformLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;
    setError(null);
    completedRef.current = false;
    chunksRef.current = [];

    if (!mimeTypeRef.current) {
      setError(
        "Your browser doesn't support in-page recording. Try the latest Chrome, Firefox, or Edge."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(micErrorMessage(err));
      return;
    }
    streamRef.current = stream;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          setWaveformLevel(Math.min(1, rms * 3));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      // Visualizer is optional; ignore failures.
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
    } catch (err) {
      cleanupStream();
      setError(err instanceof Error ? err.message : "Could not start recorder.");
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const elapsed = startMsRef.current
        ? (performance.now() - startMsRef.current) / 1000
        : 0;
      const blob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current || "audio/webm",
      });
      cleanupStream();
      setIsRecording(false);

      if (completedRef.current) return;
      completedRef.current = true;

      if (blob.size === 0) {
        setError("No audio was captured. Please try again.");
        return;
      }
      if (blob.size > MAX_BLOB_BYTES) {
        setError("Recording is over the 5 MB limit. Please try a shorter clip.");
        return;
      }
      onCompleteRef.current(blob, Math.min(elapsed, MAX_DURATION_SECONDS));
    };

    startMsRef.current = performance.now();
    setElapsedMs(0);
    setIsRecording(true);
    recorder.start(250);

    timerRef.current = setInterval(() => {
      if (!startMsRef.current) return;
      const elapsed = performance.now() - startMsRef.current;
      setElapsedMs(elapsed);
    }, 100);

    stopTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, MAX_DURATION_SECONDS * 1000);
  }, [cleanupStream, disabled, isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const remainingSeconds = useMemo(() => {
    const elapsedSec = elapsedMs / 1000;
    return Math.max(0, MAX_DURATION_SECONDS - elapsedSec);
  }, [elapsedMs]);

  const progressPct = Math.min(100, (elapsedMs / (MAX_DURATION_SECONDS * 1000)) * 100);
  const waveBars = 24;
  const barLevels = useMemo(() => {
    const arr: number[] = [];
    const base = waveformLevel;
    for (let i = 0; i < waveBars; i++) {
      const wobble = isRecording ? Math.sin((Date.now() / 60) + i) * 0.08 : 0;
      arr.push(Math.max(0.05, Math.min(1, base + wobble + (i % 2 === 0 ? 0.02 : -0.02))));
    }
    return arr;
  }, [waveformLevel, isRecording]);

  return (
    <SectionCard
      title="Record a 15-second voice clip"
      description="Read a sentence, share a thought — anything. Our AI uses this to build your Behavioral Profile."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-1 rounded-lg bg-muted/50 p-4 h-24">
          {isSupported === false ? (
            <p className="text-sm text-muted-foreground">
              In-page recording isn't supported in this browser. Try Chrome, Firefox, or Edge.
            </p>
          ) : (
            barLevels.map((level, i) => (
              <span
                key={i}
                className="block w-1.5 rounded-full bg-orange-500 transition-all duration-75"
                style={{
                  height: `${Math.round(level * 64) + 6}px`,
                  opacity: isRecording ? 0.85 : 0.35,
                }}
              />
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {isRecording ? `${remainingSeconds.toFixed(1)}s left` : "15 seconds max"}
            </span>
            <span className="text-muted-foreground">
              {isRecording ? "Recording…" : "Ready"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex justify-center">
          {isRecording ? (
            <Button
              type="button"
              size="lg"
              onClick={stopRecording}
              disabled={disabled}
              className="gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" /> Stop now
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={startRecording}
              disabled={disabled || isSupported === false}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Mic className="h-4 w-4" /> Start recording
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
