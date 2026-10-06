"use client";

import type { ReactNode } from "react";
import SnippetWavePlayer from "../SnippetWavePlayer";

/* -------------------------------------------------------------------------- */
/*  WalkPlayer — the speaker's part: a plain white box with their voice        */
/*  (founder lock 2026-10-06, "one player")                                    */
/*                                                                            */
/*  It is the app's own clip player (SnippetWavePlayer) in its ink tone, so    */
/*  the walk does not grow a second player. The speaker's words show only     */
/*  where the feedback is about them (the clearer version); pass them in      */
/*  `words`, with <s> around what changes.                                    */
/* -------------------------------------------------------------------------- */

export default function WalkPlayer({
  seed,
  src,
  startOffsetMs,
  durationMs,
  label,
  words,
}: {
  seed: string;
  src: string | null;
  startOffsetMs?: number | null;
  durationMs?: number | null;
  /** The accessible name of the clip. */
  label: string;
  words?: ReactNode;
}) {
  return (
    <div
      data-walk-player
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-3"
    >
      {words ? (
        <div className="text-[16.5px] leading-[1.55] [&_s]:text-muted-foreground [&_s]:decoration-[1.5px]">
          {words}
        </div>
      ) : null}
      <SnippetWavePlayer
        seed={seed}
        src={src}
        startOffsetMs={startOffsetMs}
        durationMs={durationMs}
        size="compact"
        tone="ink"
        label={label}
      />
    </div>
  );
}
