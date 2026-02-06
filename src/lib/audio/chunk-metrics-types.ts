/**
 * Types for ambient glow chunk metrics (pause-only).
 */

export type RecordingSlot = "recording_1" | "recording_2";

/** Chunk response: only pause_score drives the glow. Backend may send more fields; we ignore them. */
export interface ChunkMetricsResponse {
  seq: number;
  voiced_ratio: number;
  pause_score: number;
}

export type ConnectionStatus = "connecting" | "live" | "delayed" | "error";
