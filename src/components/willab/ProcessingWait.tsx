"use client";

import { useEffect, useRef, useState } from "react";
import RecordingAnalysisPresentation from "./RecordingAnalysisPresentation";
import { nextWaitPercent, waitPercent } from "@/lib/willab/waitProgress";
import { DOCUMENT_SETTLE_CAP_MS } from "@/lib/willab/documentSettle";

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
  /** When the CURRENT phase began, from the job marker. The document tail is
   *  measured from it against that phase's own deadline.
   *
   *  Omitted, this screen's own mount stands in — the honest answer for the
   *  two document-only surfaces, which have no marker in hand and whose wait
   *  genuinely begins when they appear. It is NOT the job's start epoch:
   *  seeding the tail from there would have it saturated before the document
   *  phase began, which says "nearly there" without having watched anything. */
  readonly phaseStartedAt?: number | null;
}

export default function ProcessingWait({
  progress = null,
  phase = "analysis",
  cycleStartedAt = null,
  phaseStartedAt = null,
}: ProcessingWaitProps) {
  const reported = stageIndex(progress?.stage);
  // FLOOR, not override: a document phase that genuinely reaches a LATER
  // stage keeps it. Only the two audio labels below the floor are unreachable.
  const floored =
    phase === "document" ? Math.max(reported, DOCUMENT_FLOOR) : reported;

  /* THE LABEL NEVER GOES BACKWARDS (founder 2026-09-22: "the building text is
     simply stale there").

     It was not merely frozen — it REWOUND. The analysis phase reports the
     pipeline's real stages and climbs all the way to "Finding your anchors";
     the handover then rewrites the marker `{stage: "document_assembly"}`,
     which is index 2, and the floor above holds it there. So the wait walked
     forward through five labels, stepped back two, and stopped. A screen that
     un-says what it just said reads as the machine starting over — the same
     misreading the one-screen rule exists to prevent — and then it sat on
     that older label for the whole document phase, because nothing updates
     the marker again.

     Holding the furthest label reached fixes both halves at once: no rewind,
     and the document phase inherits the last true thing the pipeline said
     rather than an earlier one. The bar is what moves from here (see
     `waitProgress`), which is the part that can honestly keep moving. */
  const reachedRef = useRef(0);
  const jobRef = useRef<number | null>(null);
  if (jobRef.current !== cycleStartedAt) {
    jobRef.current = cycleStartedAt ?? null;
    reachedRef.current = 0;
  }
  reachedRef.current = Math.max(reachedRef.current, floored);
  const current = reachedRef.current;

  /* ONE BAR ACROSS THE WHOLE WAIT (founder 2026-09-19: "there is no
     continuity there and it feels like it's stale"; 2026-09-22: "ensure that
     the progress bar ends when the full processing AND the text building is
     done so that 100% means instant switch to the ideal text").

     `held` is the analysis phase's own percent — real while reported, held
     afterwards, never falling. `waitPercent` then maps it into the lower nine
     tenths of the bar and gives the document phase the slice above, easing
     toward 99 against that phase's real deadline. The last point belongs to
     settlement, so a full bar is never something the speaker waits behind.
     The rule and the reversal it represents live in `waitProgress.ts`. */
  const held = useRef<number | null>(null);
  held.current = nextWaitPercent(held.current, progress?.percent ?? null);
  const shown = useRef<number | null>(null);

  // THE TAIL NEEDS A CLOCK. Nothing else re-renders this screen during the
  // document phase: the marker stops changing at the handover, so without a
  // tick the bar would be as motionless as the label was.
  const mountedAt = useRef(Date.now());
  const [, tick] = useState(0);
  useEffect(() => {
    if (phase !== "document") return;
    const id = setInterval(() => tick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, [phase]);

  shown.current = waitPercent({
    previous: shown.current,
    held: held.current,
    reported: phase === "document" ? (progress?.percent ?? null) : null,
    phase,
    phaseElapsedMs: Date.now() - (phaseStartedAt ?? mountedAt.current),
    capMs: DOCUMENT_SETTLE_CAP_MS,
  });

  return (
    <RecordingAnalysisPresentation
      label={PROCESSING_STAGES[current]}
      percent={shown.current}
      cycleStartedAt={cycleStartedAt}
    />
  );
}
