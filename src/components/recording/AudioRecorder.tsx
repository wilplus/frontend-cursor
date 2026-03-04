"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mic, Square, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeStrengthPace } from "@/hooks/useRealtimeStrengthPace";
import { useSniperMetrics } from "@/hooks/useSniperMetrics";
import { StrengthPaceDartboard } from "@/components/recording/StrengthPaceDartboard";
import { SniperWheel } from "@/components/recording/SniperWheel";
import { buildSniperSnapshot } from "@/lib/sniper/types";
import type { SniperSessionSnapshot } from "@/lib/sniper/types";
import { debugIngest } from "@/lib/debugIngest";

const DEFAULT_MIN_DURATION_SECONDS = 60; // 1 minute
const MAX_DURATION_SECONDS = 300; // 5 minutes

async function measureBlobDurationSeconds(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(audio.src);
      resolve(d);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Failed to load blob for duration"));
    };
  });
}

// MIME type candidates in priority order
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
];

function detectSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onRecordingStart?: () => void;
  onRecordingChange?: (active: boolean) => void;
  onBack?: () => void;
  onStartAgain?: () => void;
  onCancel?: () => void;
  /** When true: single "Stop & Send" orange button, no back/start again links, timer orange */
  stopAndSend?: boolean;
  /** When true: disable Stop/Send button and show "Uploading…" (prevents double-submit) */
  uploading?: boolean;
  /** Min duration in seconds (default 60). Use 62+ for final recording to avoid backend reject. */
  minDurationSeconds?: number;
  /** Optional prompt/question shown at top of card (e.g. "How was your day so far?") */
  prompt?: string;
  /** When true, show Sniper Wheel (5-segment voice alignment) instead of strength/pace dartboard */
  sniperMode?: boolean;
  /** When sniperMode and recording completes, called with session summary snapshot for Review. */
  onSniperSnapshot?: (snapshot: SniperSessionSnapshot) => void;
}

export default function AudioRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingChange,
  onBack,
  onStartAgain,
  onCancel,
  stopAndSend = false,
  uploading = false,
  minDurationSeconds = DEFAULT_MIN_DURATION_SECONDS,
  prompt,
  sniperMode = false,
  onSniperSnapshot,
}: AudioRecorderProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  /** Prompt font size: shrink by 2px when >3 lines, by 4px when >5 lines (at base size). */
  const [promptSizeClass, setPromptSizeClass] = useState<"default" | "medium" | "small">("default");
  const promptMeasureRef = useRef<HTMLParagraphElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFileUploadMode, setIsFileUploadMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualDuration, setManualDuration] = useState<string>("");
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [micPreviewError, setMicPreviewError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startAgainRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  /** Start mic request on pointer down so the permission prompt runs in the same user gesture (helps Safari/iOS). */
  const streamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const setIsPausedRef = useRef(setIsPaused);
  const setIsRecordingRef = useRef(setIsRecording);
  const setElapsedSecondsRef = useRef(setElapsedSeconds);
  setIsPausedRef.current = setIsPaused;
  setIsRecordingRef.current = setIsRecording;
  setElapsedSecondsRef.current = setElapsedSeconds;

  const realtimeStrengthPace = useRealtimeStrengthPace();
  const sniperMetrics = useSniperMetrics(startTimeRef);
  const lastSniperSnapshotRef = useRef<SniperSessionSnapshot | null>(null);
  const stopRealtimeRef = useRef(() => {
    if (sniperMode) sniperMetrics.stop();
    else realtimeStrengthPace.stop();
  });
  stopRealtimeRef.current = () => {
    if (sniperMode) sniperMetrics.stop();
    else realtimeStrengthPace.stop();
  };

  useEffect(() => {
    if (sniperMode && sniperMetrics.isActive) {
      lastSniperSnapshotRef.current = buildSniperSnapshot(sniperMetrics);
    }
  }, [sniperMode, sniperMetrics.isActive, sniperMetrics.overallScore, sniperMetrics.tier, sniperMetrics.scores, sniperMetrics.metrics, sniperMetrics.energyAvailable]);

  // #region agent log
  const parentLogRef = useRef({ last: 0, lastActive: false });
  useEffect(() => {
    const { isActive, targetX, targetY, score } = realtimeStrengthPace;
    const now = Date.now();
    if (isActive !== parentLogRef.current.lastActive || now - parentLogRef.current.last > 1500) {
      parentLogRef.current = { last: now, lastActive: isActive };
      fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioRecorder.tsx:render',message:'parent passing to dartboard',data:{isActive,targetX,targetY,score},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    }
  }, [realtimeStrengthPace.isActive, realtimeStrengthPace.targetX, realtimeStrengthPace.targetY, realtimeStrengthPace.score]);
  // #endregion

  // Detect MIME support on mount — always resolve so we never stick on "Checking audio support..."
  useEffect(() => {
    try {
      const detected = detectSupportedMimeType();
      if (detected) {
        setIsSupported(true);
        setMimeType(detected);
      } else {
        setIsSupported(false);
        setIsFileUploadMode(true);
      }
    } catch {
      setIsSupported(false);
      setIsFileUploadMode(true);
    }
  }, []);

  // Don't request mic on mount — browsers block getUserMedia without a user gesture (e.g. Safari).
  // Mic is requested only when the user clicks "Start Recording" (startRecording). The wheel then
  // runs from that stream. We only set micPreviewError after a failed attempt from a user action.

  // Notify parent when recording state changes (e.g. for hiding navbar / scroll lock)
  useEffect(() => {
    onRecordingChange?.(isRecording);
    return () => onRecordingChange?.(false);
  }, [isRecording, onRecordingChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRealtimeRef.current?.();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Measure prompt at base size; shrink font when >3 lines (-2px) or >5 lines (-4px)
  useLayoutEffect(() => {
    if (!prompt || !promptMeasureRef.current) {
      setPromptSizeClass("default");
      return;
    }
    const el = promptMeasureRef.current;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const lineHeightVal = style.lineHeight;
    const lhPx = lineHeightVal === "normal" ? fontSize * 1.25 : parseFloat(lineHeightVal);
    const lines = lhPx > 0 ? el.scrollHeight / lhPx : 1;
    if (lines > 5) setPromptSizeClass("small");
    else if (lines > 3) setPromptSizeClass("medium");
    else setPromptSizeClass("default");
  }, [prompt]);

  const attachOnStop = useCallback(
    (rec: MediaRecorder, mime: string) => {
      rec.onstop = () => {
        if (pauseRequestedRef.current) {
          pauseRequestedRef.current = false;
          stopRealtimeRef.current?.();
          setIsPausedRef.current(true);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return;
        }
        if (startAgainRequestedRef.current) {
          startAgainRequestedRef.current = false;
          stopRealtimeRef.current?.();
          onStartAgain?.();
        } else if (chunksRef.current.length > 0 && startTimeRef.current) {
          stopRealtimeRef.current?.();
          const blob = new Blob(chunksRef.current, { type: mime });
          const endTime = Date.now();
          const durationSeconds = Math.max(
            1,
            Math.floor((endTime - startTimeRef.current) / 1000)
          );
          setIsRecordingRef.current(false);
          if (durationSeconds < minDurationSeconds) {
            toast.error("Session must be at least 1 minute. Please record again.");
            chunksRef.current = [];
            startTimeRef.current = null;
            setElapsedSecondsRef.current?.(0);
          } else {
            // #region agent log
            measureBlobDurationSeconds(blob)
              .then((measured) => {
                debugIngest("http://127.0.0.1:7243/ingest/a80925dc-2945-4903-8e64-721670fa17b4", { location: "AudioRecorder.tsx:onstop", message: "duration ui vs blob", data: { uiDurationSeconds: durationSeconds, measuredBlobSeconds: measured, startTime: startTimeRef.current, endTime, blobSize: blob.size }, timestamp: Date.now(), hypothesisId: "H1" });
              })
              .catch(() => {});
            // #endregion
            if (lastSniperSnapshotRef.current != null && onSniperSnapshot) {
              onSniperSnapshot(lastSniperSnapshotRef.current);
            }
            onRecordingComplete(blob, durationSeconds);
          }
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    },
    [onRecordingComplete, onStartAgain, minDurationSeconds, onSniperSnapshot]
  );

  const startRecording = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setMicPreviewError("Microphone not available. Use HTTPS or localhost.");
        toast.error("Microphone not available");
        return;
      }
      // Use stream from a request started on pointer down (same user gesture), or request now
      const stream =
        streamRef.current ??
        (await (streamPromiseRef.current ?? navigator.mediaDevices.getUserMedia({ audio: true })));
      streamPromiseRef.current = null;
      if (!streamRef.current) streamRef.current = stream;
      setMicPreviewError(null);

      if (!mimeType) {
        toast.error("No supported audio format found");
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      attachOnStop(recorder, mimeType);

      recorder.onstart = () => {
        startTimeRef.current = Date.now();
        debugIngest("http://127.0.0.1:7243/ingest/a80925dc-2945-4903-8e64-721670fa17b4", { location: "AudioRecorder.tsx:recorder.onstart", message: "timer started when capture started", data: { startTime: startTimeRef.current }, timestamp: Date.now(), hypothesisId: "H1" });
      };
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      onRecordingStart?.();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioRecorder.tsx',message:'parent calling realtimeStrengthPace.start(stream)',data:{isRecording:true,hasStream:!!stream},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (sniperMode) sniperMetrics.start(stream);
      else realtimeStrengthPace.start(stream);

      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
          if (elapsed >= MAX_DURATION_SECONDS) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
          }
        }
      }, 100);
    } catch (err) {
      streamPromiseRef.current = null;
      const name = err instanceof Error ? err.name : "";
      const msg =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone was blocked. Click the lock or info icon in the address bar and set Microphone to Allow, then try again."
          : name === "NotFoundError"
            ? "No microphone found. Connect a mic and try again."
            : "Microphone could not be accessed. Use HTTPS, allow the mic, or try again.";
      setMicPreviewError(msg);
      console.error("Failed to start recording:", err);
      toast.error(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Allow microphone in your browser (address bar → site settings)"
          : "Failed to access microphone"
      );
    }
  }, [mimeType, onRecordingStart, attachOnStop, sniperMode, sniperMetrics.start, realtimeStrengthPace.start]);

  const stopRecording = useCallback(() => {
    stopRealtimeRef.current?.();
    if (isPaused) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (chunksRef.current.length > 0 && mimeType) {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSeconds = elapsedSeconds;
        if (durationSeconds >= minDurationSeconds) {
          if (sniperMode && lastSniperSnapshotRef.current != null && onSniperSnapshot) {
            onSniperSnapshot(lastSniperSnapshotRef.current);
          }
          onRecordingComplete(blob, durationSeconds);
        } else {
          toast.error("Session must be at least 1 minute. Please record again.");
        }
      }
      chunksRef.current = [];
      startTimeRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [isRecording, isPaused, mimeType, elapsedSeconds, onRecordingComplete, minDurationSeconds]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      pauseRequestedRef.current = true;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !mimeType) return;
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    attachOnStop(recorder, mimeType);

    recorder.onstart = () => {
      if (typeof window !== "undefined") {
        console.log("[rec] onstart fired", Date.now(), "elapsedSeconds=", elapsedSeconds);
      }
      startTimeRef.current = Date.now() - elapsedSeconds * 1000;
    };
    if (typeof window !== "undefined") {
      console.log("[rec] calling recorder.start()", Date.now());
    }
    recorder.start();
    if (sniperMode) sniperMetrics.start(stream);
    else realtimeStrengthPace.start(stream);
    setIsPaused(false);
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
        if (elapsed >= MAX_DURATION_SECONDS) {
          mediaRecorderRef.current?.stop();
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
        }
      }
    }, 100);
  }, [mimeType, elapsedSeconds, attachOnStop, sniperMode, sniperMetrics.start, realtimeStrengthPace.start]);

  const handleStartAgain = useCallback(() => {
    if (isPaused) {
      stopRealtimeRef.current?.();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      chunksRef.current = [];
      startTimeRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      onStartAgain?.();
    } else if (mediaRecorderRef.current && isRecording) {
      startAgainRequestedRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    } else {
      onStartAgain?.();
    }
  }, [isRecording, isPaused, onStartAgain]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Try to get duration from audio metadata
    try {
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => {
          const duration = Math.round(audio.duration);
          if (duration >= minDurationSeconds && duration <= MAX_DURATION_SECONDS) {
            setFileDuration(duration);
            setManualDuration(duration.toString());
          } else {
            setFileDuration(null);
            setManualDuration("");
          }
          URL.revokeObjectURL(audio.src);
          resolve();
        });

        audio.addEventListener("error", () => {
          URL.revokeObjectURL(audio.src);
          setFileDuration(null);
          setManualDuration("");
          resolve(); // Don't reject, allow manual input
        });

        audio.load();
      });
    } catch {
      setFileDuration(null);
      setManualDuration("");
    }
  };

  const handleFileSubmit = () => {
    if (!selectedFile) {
      toast.error("Please select an audio file");
      return;
    }

    let duration: number;
    if (fileDuration !== null) {
      duration = fileDuration;
    } else {
      const parsed = parseInt(manualDuration, 10);
      if (isNaN(parsed) || parsed < minDurationSeconds || parsed > MAX_DURATION_SECONDS) {
        toast.error(
          `Duration must be between ${minDurationSeconds} seconds (1 min) and ${MAX_DURATION_SECONDS} seconds`
        );
        return;
      }
      duration = parsed;
    }

    if (duration < minDurationSeconds) {
      toast.error("Session must be at least 1 minute.");
      return;
    }

    // Convert File to Blob
    const reader = new FileReader();
    reader.onloadend = () => {
      const blob = new Blob([reader.result as ArrayBuffer], {
        type: selectedFile.type || "audio/webm",
      });
      onRecordingComplete(blob, duration);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  if (isSupported === null) {
    return (
      <Card className="p-6 border-0 bg-transparent shadow-none">
        <p className="text-center text-muted-foreground">
          Checking audio support...
        </p>
      </Card>
    );
  }

  // File upload fallback (Safari iOS or unsupported browsers)
  if (isFileUploadMode) {
    return (
      <Card className="p-6 space-y-4 border-0 bg-transparent shadow-none">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Upload Audio Recording
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select an audio file from your device (webm, mp3, m4a, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Audio File (min 1 min, max 5 min)
          </label>
          <Input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="cursor-pointer"
          />
        </div>

        {selectedFile && (
          <div className="space-y-2">
            <p className="text-sm">
              File: <span className="font-medium">{selectedFile.name}</span>
            </p>

            {fileDuration !== null ? (
              <p className="text-sm text-muted-foreground">
                Detected duration: {formatTime(fileDuration)} (
                {fileDuration}s)
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration (seconds, required)
                </label>
                <Input
                  type="number"
                  min={minDurationSeconds}
                  max={MAX_DURATION_SECONDS}
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  placeholder={`Enter duration in seconds (min ${minDurationSeconds})`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Min {minDurationSeconds}s, max 5 min
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleFileSubmit}
            disabled={!selectedFile || (fileDuration === null && !manualDuration)}
            className="flex-1"
          >
            Use This Recording
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Progress toward max duration (5 min): 0–100%
  const progressPercent = Math.min(100, (elapsedSeconds / MAX_DURATION_SECONDS) * 100);

  // MediaRecorder mode: wheel always visible on dashboard; readout when mic is active
  return (
    <div className="w-full max-w-lg mx-auto px-0 sm:px-2 py-5 space-y-5">
      <div className="p-2 sm:p-6 space-y-5">
        {prompt && !sniperMode ? (
          <div className="relative w-full">
            <p
              ref={promptMeasureRef}
              aria-hidden
              className="absolute left-0 top-0 w-full text-center text-lg font-bold leading-snug text-foreground sm:text-xl"
              style={{ visibility: "hidden" }}
            >
              {prompt}
            </p>
            <p
              className={`w-full text-center font-bold leading-snug text-foreground ${
                promptSizeClass === "medium"
                  ? "text-base sm:text-lg"
                  : promptSizeClass === "small"
                    ? "text-sm sm:text-base"
                    : "text-lg sm:text-xl"
              }`}
            >
              {prompt}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-1 w-full overflow-hidden">
          <div className="flex justify-center w-full">
            <div className={sniperMode ? "w-full" : "w-[clamp(420px,60vw,680px)]"}>
              {sniperMode ? (
                <SniperWheel
                  scores={sniperMetrics.scores}
                  overallScore={sniperMetrics.overallScore}
                  tier={sniperMetrics.tier}
                  coachingCue={sniperMetrics.coachingCue}
                  metrics={sniperMetrics.metrics}
                  taskLabel={prompt || undefined}
                />
              ) : (
                <StrengthPaceDartboard
                  targetX={realtimeStrengthPace.targetX}
                  targetY={realtimeStrengthPace.targetY}
                />
              )}
            </div>
          </div>
        {!sniperMode && realtimeStrengthPace.isActive ? (
          <p className="text-sm text-muted-foreground">
            Strength: {realtimeStrengthPace.strengthDb.toFixed(0)} dB   Pace: {Math.round(realtimeStrengthPace.wpmEstimate)} WPM
          </p>
        ) : null}
        {!sniperMode && !realtimeStrengthPace.isActive && !isRecording && micPreviewError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {micPreviewError}
          </p>
        ) : null}
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              min. {minDurationSeconds}s
            </span>
            <span className={`font-semibold ${isRecording ? "text-primary" : "text-foreground"}`}>
              {formatTime(elapsedSeconds)}/5:00
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {!isRecording ? (
            <Button
              onPointerDown={() => {
              if (
                typeof navigator !== "undefined" &&
                navigator.mediaDevices?.getUserMedia &&
                !streamRef.current &&
                !streamPromiseRef.current
              ) {
                streamPromiseRef.current = navigator.mediaDevices.getUserMedia({ audio: true });
              }
            }}
            onClick={startRecording}
            className="h-12 w-full rounded-xl font-semibold active:scale-[0.98]"
          >
            <Mic className="mr-2 h-5 w-5" aria-hidden />
            Record an answer
          </Button>
        ) : isPaused ? (
          <div className="flex gap-2">
            <Button
              onClick={resumeRecording}
              className="h-12 flex-1 rounded-xl font-semibold active:scale-[0.98]"
            >
              <Play className="mr-2 h-5 w-5 fill-current" aria-hidden />
              Resume
            </Button>
            <Button
              onClick={stopRecording}
              disabled={uploading || elapsedSeconds < minDurationSeconds}
              className={`h-12 flex-1 rounded-xl font-semibold text-white active:scale-[0.98] ${stopAndSend ? "bg-primary hover:bg-primary/90" : "bg-red-500 hover:bg-red-600"}`}
            >
              <Square className="mr-2 h-4 w-4 fill-current" aria-hidden />
              {uploading ? "Uploading…" : stopAndSend ? "Stop & Send" : "Stop"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={pauseRecording}
              variant="outline"
              disabled={uploading}
              className="h-12 flex-1 rounded-xl font-semibold bg-muted/50 border-input text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]"
            >
              <Pause className="mr-2 h-4 w-4" aria-hidden />
              Pause
            </Button>
            <Button
              onClick={stopRecording}
              disabled={uploading || elapsedSeconds < minDurationSeconds}
              className={`h-12 flex-1 rounded-xl font-semibold text-white active:scale-[0.98] ${stopAndSend ? "bg-primary hover:bg-primary/90" : "bg-red-500 hover:bg-red-600"}`}
            >
              <Square className="mr-2 h-4 w-4 fill-current" aria-hidden />
              {uploading ? "Uploading…" : stopAndSend ? "Stop & Send" : "Stop"}
            </Button>
          </div>
        )}
        {!stopAndSend && onCancel && !isRecording && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        )}
        {!stopAndSend && onBack && <FlowBackLink onClick={onBack} />}
        {!stopAndSend && isRecording && onStartAgain && (
          <FlowBackLink onClick={handleStartAgain}>start again</FlowBackLink>
        )}
        </div>
      </div>
    </div>
  );
}
