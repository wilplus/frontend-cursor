"use client";

import { Trash } from "lucide-react";
import RecordingStrip from "./walk/RecordingStrip";

/* -------------------------------------------------------------------------- */
/*  RecordingBar — one recording bar for every short recording (founder        */
/*  2026-10-31, backend N314, locked; N304, N296 state 3).                     */
/*                                                                            */
/*  The trash on the left (the voice note's own), then the walk's recording   */
/*  strip (walk/RecordingStrip.tsx): the blinking dot, the                     */
/*  clock, the track, and the red Stop inside it. Stop sends; the trash throws */
/*  the recording away. Used by the Lounge's voice note, an answer to Will by  */
/*  voice, the plan's voice answers, the walk's practice and the tempo step.  */
/*  The strip is the locked bar file's `.rec` (N483). A Take keeps its locked */
/*  recording screen and that screen's own strip (N70, N303). "Stop" is      */
/*  signed.                                                                   */
/*  Was: the voice note's bordered pill with a black send, and the plan's own */
/*  large red Stop under the strip.                                           */
/* -------------------------------------------------------------------------- */

/** The strip's button, signed (the tempo step's word, N314). */
export const RECORDING_STOP = "Stop";
/** The trash's name, as the locked bar file has it (N483). */
export const THROW_IT_AWAY = "Throw it away";

export default function RecordingBar({
  elapsedMs,
  onTrash,
  onStop,
}: {
  elapsedMs: number;
  onTrash: () => void;
  /** Absent while the microphone is still opening: the strip shows no Stop
   *  yet (the tempo step). */
  onStop?: () => void;
}) {
  return (
    <div className="flex items-center gap-1" data-recording-bar="">
      <button
        type="button"
        onClick={onTrash}
        aria-label={THROW_IT_AWAY}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <Trash className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <RecordingStrip elapsed={elapsedMs / 1000} stopLabel={RECORDING_STOP} onStop={onStop} />
      </div>
    </div>
  );
}
