"use client";

import LoadingState from "./LoadingState";

/* -------------------------------------------------------------------------- */
/*  ProcessingWait — the processing view of the shared app loader.            */
/*                                                                            */
/*  The backend still reports real phases to its callers, but a speaker sees  */
/*  one stable full-surface wait from recording through document assembly.     */
/*  Stage labels, progress rails and rotating copy are not additional loader   */
/*  variants.                                                                  */
/* -------------------------------------------------------------------------- */

/** Kept for the processing hand-off's accessible dialog name and inline row. */
export const PROCESSING_STAGES = [
  "Processing your recording",
  "Transcribing your take",
  "Building your Ideal Text",
  "Finding feedback moments",
  "Finding your anchors",
] as const;

export interface ProcessingProgress {
  readonly stage: string;
  readonly percent: number | null;
}

export interface ProcessingWaitProps {
  readonly progress?: ProcessingProgress | null;
  readonly phase?: "analysis" | "document";
  readonly cycleStartedAt?: number | null;
  readonly phaseStartedAt?: number | null;
}

export default function ProcessingWait(_props: ProcessingWaitProps) {
  return <LoadingState placement="surface" kind="processing" />;
}
