"use client";

import { useRef } from "react";
import RecordingAnalysisPresentation from "./RecordingAnalysisPresentation";
import { nextWaitPercent } from "@/lib/willab/waitProgress";

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

/** "Building your Ideal Text" — the first label in the list that is true of a
 *  document phase, and the earliest one that does not describe audio work. */
const DOCUMENT_FLOOR = 2;

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
  /** WHICH WAIT THIS IS (founder 2026-09-16, dead-end 3 of 3). The job marker
   *  has carried this all along; the screen just never read it, so a document
   *  phase with no reported stage — a reopened overlay, a resumed job, any
   *  stage this file does not recognise — fell to index 0 and announced
   *  "Processing your recording" while nothing was touching the recording.
   *
   *  Not a second waiting screen: the one screen stays, and the label is
   *  chosen from the SAME approved list. It only stops picking a label that
   *  describes audio work during the phase that provably does none — the
   *  reassembly "re-bakes an existing document and never touches audio".
   *
   *  Omitted = "analysis", matching how an older marker deserializes. */
  readonly phase?: "analysis" | "document";
  /** Epoch shared by every view of one job. It keeps the same tip cycle when
   *  the presentation closes and reopens; omitting it starts a local cycle. */
  readonly cycleStartedAt?: number | null;
}

export default function ProcessingWait({
  progress = null,
  phase = "analysis",
  cycleStartedAt = null,
}: ProcessingWaitProps) {
  const reported = stageIndex(progress?.stage);
  // FLOOR, not override: a document phase that genuinely reaches a LATER
  // stage keeps it. Only the two audio labels below the floor are unreachable.
  const current =
    phase === "document" ? Math.max(reported, DOCUMENT_FLOOR) : reported;

  /* ONE BAR ACROSS THE WHOLE WAIT (founder 2026-09-19: "there is no
     continuity there and it feels like it's stale"). The document phase
     reports no percent, and a null renders as "…" at width 0 — so the bar
     climbed through analysis, collapsed to nothing, and the text then
     appeared from nowhere. It HOLDS the last real percent instead. Nothing is
     invented: see `waitProgress.ts` for why the first version of this, which
     advanced on elapsed time, was refused by the gate. */
  const shown = useRef<number | null>(null);
  shown.current = nextWaitPercent(shown.current, progress?.percent ?? null);

  return (
    <RecordingAnalysisPresentation
      label={PROCESSING_STAGES[current]}
      percent={shown.current}
      cycleStartedAt={cycleStartedAt}
    />
  );
}
