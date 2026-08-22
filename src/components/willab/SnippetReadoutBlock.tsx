"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";

/* -------------------------------------------------------------------------- */
/*  SnippetReadoutBlock — the snippet readout block in the COACH review card.  */
/*                                                                            */
/*  #191 — narrowed to key moments. The coach sees ONLY:                       */
/*    - MediaPlayer (playback of the exact span)                               */
/*    - the transcript (what was said, so the coach can comment)               */
/*                                                                            */
/*  THE ACOUSTIC POTENTIOMETER WAS REMOVED 2026-08-07, along with the raw      */
/*  feature disclosure under it. This block sits inside the BLIND labeling     */
/*  flow (see starVerdictSeparation.test.ts), and the backend stamps           */
/*  saw_model_output=false on every rating collected there. Rendering the       */
/*  machine's read next to the label controls made that stamp a lie — and an   */
/*  anchored label is indistinguishable from a blind one once it is in the     */
/*  corpus. The needle belongs to the ADJUDICATION lane, whose whole job is    */
/*  judging the machine's output, on its own screen.                            */
/*                                                                            */
/*  Machine-derived read props are absent rather than merely unused: an        */
/*  prop is an open door back in, and the import fence cannot catch a value    */
/*  that arrives on the labeler's own payload.                                 */
/* -------------------------------------------------------------------------- */

export default function SnippetReadoutBlock({
  audioRef,
  startOffsetMs,
  durationMs,
  transcript,
}: {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
}) {
  return (
    <>
      {/* Playback FIRST (directly below the slide) → then the transcript. */}
      <div className="flex flex-col gap-3">
        <MediaPlayer
          src={audioRef}
          startOffsetMs={startOffsetMs}
          durationMs={durationMs}
        />
        {transcript ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
            <p className="text-[15px] leading-relaxed text-foreground">
              {transcript}
            </p>
          </div>
        ) : null}
      </div>

    </>
  );
}
