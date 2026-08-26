"use client";

import MediaPlayer from "@/components/results/MediaPlayer";

/* -------------------------------------------------------------------------- */
/*  One evidence-timing primitive for every blind confidence-rating surface.  */
/*                                                                            */
/*  Before a server-confirmed answer it renders the exact audio interval only. */
/*  After confirmation it may reveal the transcript. It accepts no machine   */
/*  output, score, band, slide, feedback, or contextual recommendation.       */
/* -------------------------------------------------------------------------- */

export default function ConfidenceEvidenceReadout({
  audioRef,
  startOffsetMs,
  durationMs,
  transcript,
  transcriptRevealed,
}: {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  /** Must mean a server-confirmed answer, never a local button selection. */
  transcriptRevealed: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MediaPlayer
        src={audioRef}
        startOffsetMs={startOffsetMs}
        durationMs={durationMs}
      />
      {transcriptRevealed && transcript ? (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
          <p className="text-[15px] leading-relaxed text-foreground">
            {transcript}
          </p>
        </div>
      ) : null}
    </div>
  );
}
