"use client";

import { coerceTargetSeconds, formatRecordingClock } from "../willabHelpers";

/* -------------------------------------------------------------------------- */
/*  RecordingStrip — the one recording bar's strip (backend N314, N483), for   */
/*  the walk's practise, the tempo step, the plan and the chats' voice note    */
/*  (through RecordingBar).                                                   */
/*                                                                            */
/*  Built to the locked bar prototype's `.rec` (backend docs/design/          */
/*  customer-requests-2026-10-28/the-bar/the-bar-clickable.html): a 48px grey */
/*  pill, the 8px blinking red dot, the mono 14px clock, a 3px grey track     */
/*  with a black fill, and the red Stop with a white square, in the one red   */
/*  #EF4444. Was: a copy of the recording screen's strip (rounded-2xl, 17px   */
/*  clock, a 4px grey/orange/red bar); the recording screen keeps its own     */
/*  strip, inline in LabOverlay's RecordingPhase (N70), untouched. The clock  */
/*  counts down to a target and up past it, or counts up with none; the bar  */
/*  never shows a number (AC-9).                                              */
/* -------------------------------------------------------------------------- */

/** The locked file's one red, for the dot and Stop (`--app-red`). */
const BAR_RED = "#EF4444";

/** The fill: toward a target when there is one, else as the locked file's
 *  own track grows (4% a second, full at 25 seconds). */
function fillWidth(elapsed: number, target: number | null): string {
  if (target == null) return `${Math.min(100, elapsed * 4)}%`;
  return `${Math.min(100, (elapsed / target) * 100)}%`;
}

export default function RecordingStrip({
  elapsed,
  targetSec = null,
  stopLabel,
  onStop,
}: {
  elapsed: number;
  targetSec?: number | string | null;
  /** Absent: the strip holds only the dot, the clock and the bar (the
   *  practise, founder lock 2026-10-12, section 2.5). */
  stopLabel?: string;
  onStop?: () => void;
}) {
  const { label: clockLabel, overrun } = formatRecordingClock(elapsed, targetSec);
  const target = coerceTargetSeconds(targetSec);
  return (
    <div data-walk-recording-strip className="flex h-12 items-center gap-2.5 rounded-full bg-muted pl-3.5 pr-[5px]">
      <span
        className="h-2 w-2 shrink-0 rounded-full motion-safe:animate-rec-blink"
        style={{ backgroundColor: BAR_RED }}
        aria-hidden
      />
      <span
        className="font-mono text-[14px] font-bold tabular-nums text-foreground"
        style={overrun ? { color: BAR_RED } : undefined}
      >
        {clockLabel}
      </span>
      <div className="relative h-[3px] flex-1 overflow-hidden rounded-[2px] bg-[#D9D9D9]" aria-hidden>
        <div
          className="h-full bg-[#121212] transition-[width] duration-200"
          style={{ width: fillWidth(elapsed, target) }}
        />
      </div>
      {onStop ? (
      <button
        type="button"
        onClick={onStop}
        aria-label={stopLabel}
        className="flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.03]"
        style={{ backgroundColor: BAR_RED }}
      >
        <span className="h-2.5 w-2.5 rounded-[2px] bg-white" aria-hidden />
        {stopLabel}
      </button>
      ) : null}
    </div>
  );
}
