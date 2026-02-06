/**
 * Types for ambient glow chunk metrics (contract-aligned with backend).
 */

export type RecordingSlot = "recording_1" | "recording_2";

export interface ChunkMetricsResponse {
  seq: number;
  voiced_ratio: number;
  pacing_score: number;
  pacing_delta: number;
  intonation_score: number;
  intonation_delta: number;
  pause_score: number;
  pause_delta: number;
}

export type ConnectionStatus = "connecting" | "live" | "delayed" | "error";
