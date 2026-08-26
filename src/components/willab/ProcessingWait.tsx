"use client";

import RecordingAnalysisPresentation from "./RecordingAnalysisPresentation";

/* -------------------------------------------------------------------------- */
/*  ProcessingWait — THE ONE WAITING SCREEN (founder 2026-08-11)               */
/*                                                                            */
/*  "The loading screen differs — it is the official loading and then it       */
/*  changes to working on your text, and it should be one loading."            */
/*                                                                            */
/*  It was two screens because the wait is genuinely two server phases: the    */
/*  pipeline running to `readout_ready`, then the arc's document reassembling. */
/*  That distinction is real to the backend and means nothing to the person    */
/*  holding the phone, who sees one wait interrupted by a change of subject —  */
/*  and reads the second screen as the machine starting over. (It is not:      */
/*  the reassembly re-bakes an existing document and never touches audio.)     */
/*                                                                            */
/*  So both phases render THIS. The founder picked the elaborate one — the     */
/*  mark, the rotating status line, one tip — and "Working on your text" is    */
/*  deleted rather than kept as a variant, because a second waiting copy that  */
/*  still exists is a second waiting copy that comes back.                     */
/* -------------------------------------------------------------------------- */

/** Human-readable labels for the real server-side processing stages. */
export const PROCESSING_STAGES = [
  "Processing your recording",
  "Transcribing your take",
  "Building your Ideal Text",
  "Finding feedback moments",
  "Finding your anchors",
] as const;

function stageIndex(stage?: string): number {
  if (stage === "transcribing" || stage === "analysis") return 1;
  if (
    stage === "ideal_text" ||
    stage === "post_processing" ||
    stage === "document_assembly"
  )
    return 2;
  if (stage === "feedback_moments") return 3;
  if (
    stage === "speaking_anchors" ||
    stage === "finalizing" ||
    stage === "completed"
  )
    return 4;
  return 0;
}

export interface ProcessingProgress {
  readonly stage: string;
  readonly percent: number | null;
}

export interface ProcessingWaitProps {
  readonly progress?: ProcessingProgress | null;
  /** Epoch shared by every view of one job. It keeps the same tip cycle when
   *  the presentation closes and reopens; omitting it starts a local cycle. */
  readonly cycleStartedAt?: number | null;
}

export default function ProcessingWait({
  progress = null,
  cycleStartedAt = null,
}: ProcessingWaitProps) {
  const current = stageIndex(progress?.stage);
  const measuredPercent = progress?.percent;

  return (
    <RecordingAnalysisPresentation
      label={PROCESSING_STAGES[current]}
      percent={
        typeof measuredPercent === "number" ? measuredPercent : null
      }
      cycleStartedAt={cycleStartedAt}
    />
  );
}
