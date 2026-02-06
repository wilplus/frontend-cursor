"use client";

import { useState, useCallback, useRef } from "react";
import { startChunkPipeline } from "@/lib/audio/pcm-chunk-pipeline";
import type { RecordingSlot } from "@/lib/audio/chunk-metrics-types";
import type { ChunkMetricsResponse } from "@/lib/audio/chunk-metrics-types";
import {
  isSilence,
  getPauseScoreFromResponse,
  smoothPauseScore,
  pauseScoreToGlowHSL,
  hslToCss,
} from "@/lib/audio/glow-color";

/** Initial color before any chunk (soft green = "ready/listening"). */
const INITIAL_GLOW_CSS = "hsl(140, 70%, 45%)";

export type ChunkConnectionStatus = "connecting" | "live" | "delayed" | "error";

export interface UseChunkMetricsResult {
  connectionStatus: ChunkConnectionStatus;
  glowColor: string;
  /** Timestamp (ms) when a pause was last detected (voiced_ratio < threshold); 0 if none. Used to flash a red dot. */
  lastPauseDetectedAt: number;
  start: (stream: MediaStream) => void;
  stop: () => void;
  isActive: boolean;
}

export function useChunkMetrics(
  sessionId: string | null,
  recordingSlot: RecordingSlot | null
): UseChunkMetricsResult {
  const [connectionStatus, setConnectionStatus] = useState<ChunkConnectionStatus>("connecting");
  const [glowColor, setGlowColor] = useState<string>(INITIAL_GLOW_CSS);
  const [lastPauseDetectedAt, setLastPauseDetectedAt] = useState<number>(0);

  const lastAppliedSeqRef = useRef<number>(-1);
  const smoothedPauseScoreRef = useRef<number>(1);
  const pipelineRef = useRef<ReturnType<typeof startChunkPipeline> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    (stream: MediaStream) => {
      if (!sessionId || !recordingSlot) return;

      lastAppliedSeqRef.current = -1;
      smoothedPauseScoreRef.current = 1;
      setConnectionStatus("connecting");
      setGlowColor(INITIAL_GLOW_CSS);
      setLastPauseDetectedAt(0);

      abortRef.current = new AbortController();

      pipelineRef.current = startChunkPipeline(stream, sessionId, recordingSlot, {
        onResponse(data: ChunkMetricsResponse) {
          const seq = typeof data.seq === "number" && Number.isFinite(data.seq) ? data.seq : 0;
          if (seq <= lastAppliedSeqRef.current) return;
          lastAppliedSeqRef.current = seq;

          const voicedRatio = typeof data.voiced_ratio === "number" ? data.voiced_ratio : 1;
          if (isSilence(voicedRatio)) {
            setLastPauseDetectedAt(Date.now());
            return;
          }

          const pauseScore = getPauseScoreFromResponse(data);
          const smoothed = smoothPauseScore(pauseScore, smoothedPauseScoreRef.current);
          smoothedPauseScoreRef.current = smoothed;
          const hsl = pauseScoreToGlowHSL(smoothed);
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
    lastPauseDetectedAt,
    start,
    stop,
    isActive,
  };
}
