"use client";

import { useEffect, useState } from "react";
import { VoiceMark } from "./LoadingState";
import { pickWaitingTip } from "./waitingTips";

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
export const PROCESSING_LINES = [
  "Transcribing your voice…",
  "Finding your strongest moments…",
  "Lining up your slides…",
  "Measuring your delivery…",
  "Almost there…",
];

export default function ProcessingWait({
  markSize = 88,
}: {
  /** The pipeline phase gives it the full stage; the document phase shares a
   *  screen with the way out and the next-take button, so it runs smaller. */
  markSize?: number;
}) {
  const [lineIdx, setLineIdx] = useState(0);
  // One tip for the whole wait, drawn after mount so the server and client
  // never disagree about which one came up.
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => setTip(pickWaitingTip()), []);
  useEffect(() => {
    const id = setInterval(
      () => setLineIdx((i) => (i + 1) % PROCESSING_LINES.length),
      3000
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 text-center">
      <VoiceMark size={markSize} />
      <p className="flex min-h-[1.5rem] items-center text-[15px] text-foreground">
        {PROCESSING_LINES[lineIdx]}
      </p>
      {/* ONE tip for this wait, drawn once. The status line above already says
          what is happening; this slot is worth more as something to read than
          as a duration guess we cannot keep. */}
      {tip ? (
        <p className="max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
          {tip}
        </p>
      ) : null}
    </div>
  );
}
