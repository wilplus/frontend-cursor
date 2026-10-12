/* -------------------------------------------------------------------------- */
/*  recordingProgress — progress toward the first audit (C-2 / S2)            */
/*                                                                            */
/*  { recorded_seconds, threshold_seconds, unlocked }, read from the upload      */
/*  response. The cumulative seconds the user has recorded across all their     */
/*  sessions vs the 600s (10 min) threshold that unlocks their first audit.      */
/*                                                                            */
/*  The FE NEVER sums snippet durations for this — snippet windows are selected   */
/*  excerpts, not total recording time. The cumulative total is BE-owned (S2).    */
/*  Soft-fails to null until BE-1 ships the endpoint → the FE hides the progress  */
/*  bubble entirely (graceful degradation, no empty shell).                      */
/* -------------------------------------------------------------------------- */

export interface RecordingProgress {
  /** Cumulative seconds recorded across all the user's sessions (BE-owned). */
  recordedSeconds: number;
  /** Seconds needed to unlock the first audit (S2 fixes this at 600). */
  thresholdSeconds: number;
  /** BE-authoritative unlock flag (derived from the totals if the BE omits it). */
  unlocked: boolean;
}

export function mapRecordingProgress(raw: unknown): RecordingProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const recorded =
    typeof r.recorded_seconds === "number" && Number.isFinite(r.recorded_seconds)
      ? Math.max(0, r.recorded_seconds)
      : null;
  const threshold =
    typeof r.threshold_seconds === "number" &&
    Number.isFinite(r.threshold_seconds) &&
    r.threshold_seconds > 0
      ? r.threshold_seconds
      : null;
  if (recorded === null || threshold === null) return null;
  return {
    recordedSeconds: recorded,
    thresholdSeconds: threshold,
    unlocked:
      typeof r.unlocked === "boolean" ? r.unlocked : recorded >= threshold,
  };
}
