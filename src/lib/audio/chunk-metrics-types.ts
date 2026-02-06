/**
 * Types for ambient glow chunk metrics (pause-only).
 */

export type RecordingSlot = "recording_1" | "recording_2";

/** Chunk response: pause_score drives the glow; pause_detected (when present) drives the red dot. */
export interface ChunkMetricsResponse {
  seq: number;
  voiced_ratio: number;
  pause_score: number;
  /** When true, backend detected a pause event (use this for the red dot). Omit in mock. */
  pause_detected?: boolean;
  /** Debug: why pause was or wasn’t detected. Only when X-Debug: 1. */
  pause_why?: string;
  /** Debug: last 20 frames as S (silence) / V (voice). Only when X-Debug: 1. */
  _debug?: { tail_20?: string; pause_why?: string; [key: string]: unknown };
}

export type ConnectionStatus = "connecting" | "live" | "delayed" | "error";
