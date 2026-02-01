"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  onCancel?: () => void;
}

export default function AudioRecorder({
  onRecordingComplete,
  onCancel,
}: AudioRecorderProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
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

      recorder.onstop = () => {
        if (chunksRef.current.length > 0 && startTimeRef.current) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const endTime = Date.now();
          const durationSeconds = Math.max(
            1,
            Math.round((endTime - startTimeRef.current) / 1000)
          );
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

      startTimeRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setElapsedSeconds(0);

      // Timer interval
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);

          // Auto-stop at max duration
          if (elapsed >= MAX_DURATION_SECONDS) {
            stopRecording();
          }
        }
      }, 100);
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast.error("Failed to access microphone");
    }
  }, [mimeType, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [isRecording]);

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

  // MediaRecorder mode
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Record Audio</h3>
        <p className="text-sm text-muted-foreground">
          Click start to begin recording. Min 1 min, max 5 min.
        </p>
      </div>

      <div className="text-center py-4">
        <div className="text-4xl font-mono font-bold">
          {formatTime(elapsedSeconds)}
        </div>
        {isRecording && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Recording...</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!isRecording ? (
          <>
            <Button onClick={startRecording} className="flex-1">
              Start Recording
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </>
        ) : (
          <Button onClick={stopRecording} className="flex-1" variant="outline">
            Stop Recording
          </Button>
        )}
      </div>
    </Card>
  );
}
