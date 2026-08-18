"use client";

import { useEffect, useRef } from "react";
import { VoiceMark } from "./LoadingState";
import { WAITING_TIPS } from "./waitingTips";
import {
  availableAdviceStorage,
  readAdviceScroll,
  writeAdviceScroll,
} from "./processingAdviceScroll";
import { availableWaitingTips } from "./processingWaitingTips";

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

/** C11 — rotate the analyzing line so the wait feels alive (swaps every 3s). */
export const PROCESSING_STAGES = [
  "Processing your recording",
  "Transcribing your take",
  "Building your Ideal Text",
  "Finding feedback moments",
  "Preparing your speaking anchors",
] as const;

function stageIndex(stage?: string): number {
  if (stage === "transcribing" || stage === "analysis") return 1;
  if (stage === "ideal_text" || stage === "post_processing") return 2;
  if (stage === "feedback_moments") return 3;
  if (
    stage === "speaking_anchors" ||
    stage === "finalizing" ||
    stage === "completed"
  ) return 4;
  return 0;
}

export default function ProcessingWait({
  markSize = 44,
  progress = null,
}: {
  /** The pipeline phase gives it the full stage; the document phase shares a
   *  screen with the way out and the next-take button, so it runs smaller. */
  markSize?: number;
  progress?: { stage: string; percent: number } | null;
}) {
  const adviceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = adviceRef.current;
    if (!node) return;
    node.scrollTop = readAdviceScroll(availableAdviceStorage());
  }, []);
  const current = stageIndex(progress?.stage);
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const waitingTips = availableWaitingTips(WAITING_TIPS);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <VoiceMark size={markSize} />
      <div className="w-full px-3">
        <div className="mb-1.5 flex items-center justify-between gap-4 text-left text-[12px] text-foreground">
          <span>{PROCESSING_STAGES[current]}</span>
          <span className="tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={PROCESSING_STAGES[current]}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div
        ref={adviceRef}
        onScroll={(event) =>
          writeAdviceScroll(
            availableAdviceStorage(),
            event.currentTarget.scrollTop
          )
        }
        className="scrollbar-none h-[42vh] min-h-48 max-h-80 w-full snap-y snap-mandatory scroll-smooth overflow-y-auto overscroll-contain px-3"
        aria-label="Presentation advice"
      >
        <div className="h-full">
          {waitingTips.map((tip, index) => (
            <p
              key={index}
              className="flex min-h-full snap-start snap-always items-center justify-center px-2 text-center text-[14px] leading-relaxed text-muted-foreground"
            >
              {tip}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
