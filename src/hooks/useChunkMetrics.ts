"use client";

import { useState, useCallback, useRef } from "react";
import { startChunkPipeline } from "@/lib/audio/pcm-chunk-pipeline";
import type { RecordingSlot } from "@/lib/audio/chunk-metrics-types";
import type { ChunkMetricsResponse } from "@/lib/audio/chunk-metrics-types";
import {
  isSilence,
  responseToFrame,
  smoothFrames,
  metricsToGlowHSL,
  hslToCss,
  type SmoothedFrame,
} from "@/lib/audio/glow-color";

const SMOOTHING_WINDOW = 8;

export type ChunkConnectionStatus = "connecting" | "live" | "delayed" | "error";

export interface UseChunkMetricsResult {
  connectionStatus: ChunkConnectionStatus;
  glowColor: string;
  start: (stream: MediaStream) => void;
  stop: () => void;
  isActive: boolean;
}

const NEUTRAL_CSS = "hsl(0, 0%, 35%)";

export function useChunkMetrics(
  sessionId: string | null,
  recordingSlot: RecordingSlot | null
): UseChunkMetricsResult {
  const [connectionStatus, setConnectionStatus] = useState<ChunkConnectionStatus>("connecting");
  const [glowColor, setGlowColor] = useState<string>(NEUTRAL_CSS);

  const lastAppliedSeqRef = useRef<number>(-1);
  const bufferRef = useRef<SmoothedFrame[]>([]);
  const pipelineRef = useRef<ReturnType<typeof startChunkPipeline> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    (stream: MediaStream) => {
      if (!sessionId || !recordingSlot) return;

      lastAppliedSeqRef.current = -1;
      bufferRef.current = [];
      setConnectionStatus("connecting");
      setGlowColor(NEUTRAL_CSS);

      abortRef.current = new AbortController();

      pipelineRef.current = startChunkPipeline(stream, sessionId, recordingSlot, {
        onResponse(data: ChunkMetricsResponse) {
          if (data.seq <= lastAppliedSeqRef.current) return;
          lastAppliedSeqRef.current = data.seq;

          if (isSilence(data.voiced_ratio)) {
            // Keep last color or fade to neutral: don't push bad metrics
            return;
          }

          const frame = responseToFrame(data);
          bufferRef.current.push(frame);
          if (bufferRef.current.length > SMOOTHING_WINDOW) {
            bufferRef.current.shift();
          }
          const smoothed = smoothFrames(bufferRef.current);
          const hsl = metricsToGlowHSL(smoothed);
          setGlowColor(hslToCss(hsl));
        },
        onConnectionChange(status) {
          setConnectionStatus(status);
        },
        getAbortSignal: () => abortRef.current?.signal,
      });
    },
    [sessionId, recordingSlot]
  );

  const stop = useCallback(() => {
    if (pipelineRef.current) {
      pipelineRef.current.stop();
      pipelineRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const isActive = pipelineRef.current !== null;

  return {
    connectionStatus,
    glowColor,
    start,
    stop,
    isActive,
  };
}
