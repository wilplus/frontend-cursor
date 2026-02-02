"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mic, Square, Pause, Play } from "lucide-react";
import { toast } from "sonner";

const MIN_DURATION_SECONDS = 60; // 1 minute
const MAX_DURATION_SECONDS = 300; // 5 minutes

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
  onBack?: () => void;
  onStartAgain?: () => void;
  onCancel?: () => void;
}

export default function AudioRecorder({
  onRecordingComplete,
  onRecordingStart,
  onBack,
  onStartAgain,
  onCancel,
}: AudioRecorderProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFileUploadMode, setIsFileUploadMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualDuration, setManualDuration] = useState<string>("");
  const [fileDuration, setFileDuration] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startAgainRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const setIsPausedRef = useRef(setIsPaused);
  const setIsRecordingRef = useRef(setIsRecording);
  setIsPausedRef.current = setIsPaused;
  setIsRecordingRef.current = setIsRecording;

  // Detect MIME support on mount
  useEffect(() => {
    const detected = detectSupportedMimeType();
    if (detected) {
      setIsSupported(true);
      setMimeType(detected);
    } else {
      setIsSupported(false);
      setIsFileUploadMode(true);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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

  const attachOnStop = useCallback(
    (rec: MediaRecorder, mime: string) => {
      rec.onstop = () => {
        if (pauseRequestedRef.current) {
          pauseRequestedRef.current = false;
          setIsPausedRef.current(true);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return;
        }
        if (startAgainRequestedRef.current) {
          startAgainRequestedRef.current = false;
          onStartAgain?.();
        } else if (chunksRef.current.length > 0 && startTimeRef.current) {
          const blob = new Blob(chunksRef.current, { type: mime });
          const endTime = Date.now();
          const durationSeconds = Math.max(
            1,
            Math.round((endTime - startTimeRef.current) / 1000)
          );
          setIsRecordingRef.current(false);
          if (durationSeconds < MIN_DURATION_SECONDS) {
            toast.error("Session must be at least 1 minute. Please record again.");
            chunksRef.current = [];
            startTimeRef.current = null;
          } else {
            onRecordingComplete(blob, durationSeconds);
          }
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    },
    [onRecordingComplete, onStartAgain]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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

      startTimeRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      onRecordingStart?.();

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
      console.error("Failed to start recording:", err);
      toast.error("Failed to access microphone");
    }
  }, [mimeType, onRecordingStart, attachOnStop]);

  const stopRecording = useCallback(() => {
    if (isPaused) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (chunksRef.current.length > 0 && mimeType) {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSeconds = elapsedSeconds;
        if (durationSeconds >= MIN_DURATION_SECONDS) {
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
  }, [isRecording, isPaused, mimeType, elapsedSeconds, onRecordingComplete]);

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
    startTimeRef.current = Date.now() - elapsedSeconds * 1000;
    recorder.start();
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
  }, [mimeType, elapsedSeconds, attachOnStop]);

  const handleStartAgain = useCallback(() => {
    if (isPaused) {
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
          if (duration >= MIN_DURATION_SECONDS && duration <= MAX_DURATION_SECONDS) {
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
      if (isNaN(parsed) || parsed < MIN_DURATION_SECONDS || parsed > MAX_DURATION_SECONDS) {
        toast.error(
          `Duration must be between ${MIN_DURATION_SECONDS} seconds (1 min) and ${MAX_DURATION_SECONDS} seconds`
        );
        return;
      }
      duration = parsed;
    }

    if (duration < MIN_DURATION_SECONDS) {
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
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Checking audio support...
        </p>
      </Card>
    );
  }

  // File upload fallback (Safari iOS or unsupported browsers)
  if (isFileUploadMode) {
    return (
      <Card className="p-6 space-y-4">
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
                  min={MIN_DURATION_SECONDS}
                  max={MAX_DURATION_SECONDS}
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  placeholder="Enter duration in seconds (min 60)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Min 1 min, max 5 min
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

  // Progress toward minimum (60s): 0–100%
  const progressPercent = Math.min(100, (elapsedSeconds / MIN_DURATION_SECONDS) * 100);
  const remainingSeconds = Math.max(0, MIN_DURATION_SECONDS - elapsedSeconds);

  // MediaRecorder mode
  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <div
          className={`text-4xl font-mono font-bold ${isRecording ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
        >
          {formatTime(elapsedSeconds)}
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatTime(remainingSeconds)} remaining to reach minimum
        </p>
      </div>

      <div className="space-y-3">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            className="w-full rounded-full py-6 text-base font-semibold"
          >
            <Mic className="mr-2 h-5 w-5" aria-hidden />
            Start Recording
          </Button>
        ) : isPaused ? (
          <div className="flex gap-2">
            <Button
              onClick={resumeRecording}
              className="flex-1 rounded-full py-5 text-base font-semibold"
            >
              <Play className="mr-2 h-5 w-5 fill-current" aria-hidden />
              Resume
            </Button>
            <Button
              onClick={stopRecording}
              className="flex-1 rounded-full bg-red-500 py-5 text-base font-semibold hover:bg-red-600"
            >
              <Square className="mr-2 h-4 w-4 fill-current" aria-hidden />
              Stop
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={pauseRecording}
              variant="outline"
              className="flex-1 rounded-full py-5 text-base font-semibold bg-muted/50 border-input text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pause className="mr-2 h-4 w-4" aria-hidden />
              Pause
            </Button>
            <Button
              onClick={stopRecording}
              className="flex-1 rounded-full bg-red-500 py-5 text-base font-semibold hover:bg-red-600"
            >
              <Square className="mr-2 h-4 w-4 fill-current" aria-hidden />
              Stop
            </Button>
          </div>
        )}
        {onCancel && !isRecording && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        )}
        {onBack && <FlowBackLink onClick={onBack} />}
        {isRecording && onStartAgain && (
          <FlowBackLink onClick={handleStartAgain}>start again</FlowBackLink>
        )}
      </div>
    </Card>
  );
}
