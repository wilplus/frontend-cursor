"use client";

import { Trash2 } from "lucide-react";
import RecordingStrip from "./walk/RecordingStrip";

/* -------------------------------------------------------------------------- */
/*  RecordingBar — one recording bar for every short recording (founder        */
/*  2026-10-31, backend N314, locked; N304, N296 state 3).                     */
/*                                                                            */
/*  The trash on the left (the voice note's own), then the walk's recording   */
/*  strip, class for class (walk/RecordingStrip.tsx): the pulsing dot, the     */
/*  clock, the track, and the red Stop inside it. Stop sends; the trash throws */
/*  the recording away. Used by the Lounge's voice note, an answer to Will by  */
/*  voice and the plan's voice answers. A Take keeps its locked recording      */
/*  screen, whose strip is the same (N70, N303). "Stop" is signed.            */
/*  Was: the voice note's bordered pill with a black send, and the plan's own */
/*  large red Stop under the strip.                                           */
/* -------------------------------------------------------------------------- */

/** The strip's button, signed (the tempo step's word, N314). */
export const RECORDING_STOP = "Stop";

export default function RecordingBar({
  elapsedMs,
  onTrash,
  onStop,
}: {
  elapsedMs: number;
  onTrash: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center gap-1" data-recording-bar="">
      <button
        type="button"
        onClick={onTrash}
        aria-label="Delete"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <RecordingStrip elapsed={elapsedMs / 1000} stopLabel={RECORDING_STOP} onStop={onStop} />
      </div>
    </div>
  );
}
