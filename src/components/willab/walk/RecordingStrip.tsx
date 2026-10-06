"use client";

import { Square } from "lucide-react";
import { coerceTargetSeconds, formatRecordingClock } from "../willabHelpers";

/* -------------------------------------------------------------------------- */
/*  RecordingStrip — the Take's own recording bar, for the walk's practise     */
/*  (founder lock 2026-10-06: "Recording uses the Take's own recording bar").  */
/*                                                                            */
/*  A FAITHFUL COPY of the strip inline in LabOverlay's RecordingPhase, class  */
/*  for class: pulsing dot → clock → numberless bar → stop. It is a copy, not  */
/*  an extraction, because recordingScreen.test.ts pins the strip's source     */
/*  inside RecordingPhase; moving it out is its own change. Keep the two in    */
/*  step until then. The clock counts down to a target and up past it as the  */
/*  record-red overrun, or counts up with none; the bar never shows a number  */
/*  (AC-9).                                                                   */
/* -------------------------------------------------------------------------- */

function barClass(overrun: boolean, target: number | null): string {
  if (overrun) return "motion-safe:animate-pulse bg-record";
  if (target == null) return "motion-safe:animate-pulse bg-muted-foreground/40";
  return "bg-primary";
}

export default function RecordingStrip({
  elapsed,
  targetSec = null,
  stopLabel,
  onStop,
}: {
  elapsed: number;
  targetSec?: number | string | null;
  stopLabel: string;
  onStop: () => void;
}) {
  const { label: clockLabel, overrun } = formatRecordingClock(elapsed, targetSec);
  const target = coerceTargetSeconds(targetSec);
  return (
    <div data-walk-recording-strip className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-record/50 motion-safe:animate-pulse" aria-hidden />
      <span
        className={`font-mono text-[17px] font-semibold tabular-nums ${overrun ? "text-record" : "text-foreground"}`}
      >
        {clockLabel}
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${barClass(overrun, target)}`}
          style={{ width: target == null ? "100%" : `${Math.min(100, (elapsed / target) * 100)}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onStop}
        aria-label={stopLabel}
        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-record px-4 text-[13px] font-semibold text-record-foreground transition-transform hover:scale-[1.03]"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
        {stopLabel}
      </button>
    </div>
  );
}
