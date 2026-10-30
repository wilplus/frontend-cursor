"use client";

import { VoiceMark } from "./LoadingState";

/* -------------------------------------------------------------------------- */
/*  RecordingAnalysisPresentation — post-recording analysis, and only that.   */
/*                                                                            */
/*  This is the single richer waiting state: real pipeline stage, real          */
/*  percentage and the orange progress rail. Generic route/auth/data waits use */
/*  LoadingState and therefore cannot inherit this analysis-only information   */
/*  architecture by accident.                                                  */
/*                                                                            */
/*  THE CALM WAIT (founder 2026-10-29, backend N271 item 2, N273 item 3: "The  */
/*  wait says 'Usually about a minute.' yes and hide the slider with the       */
/*  suggestions the advices"; approved on the prototype). One narrow column,   */
/*  nothing to read and nothing to scroll: the breathing mark, the stage and   */
/*  its percent, a rounded bar, and one line under it. "While you wait" and    */
/*  its scrollable advice are gone, with the modules that held them.           */
/* -------------------------------------------------------------------------- */

/** The one line under the bar (N271 item 2, signed). */
export const WAIT_EXPECTATION = "Usually about a minute.";

export interface RecordingAnalysisPresentationProps {
  /** Truthful lifecycle label supplied by the recording-analysis pipeline. */
  readonly label: string;
  /** Real percentage, or null while the pipeline exposes no measurable value. */
  readonly percent: number | null;
}

export default function RecordingAnalysisPresentation({
  label,
  percent: measuredPercent,
}: RecordingAnalysisPresentationProps) {
  const percent =
    typeof measuredPercent === "number" && Number.isFinite(measuredPercent)
      ? Math.max(0, Math.min(100, measuredPercent))
      : null;

  return (
    <div className="flex w-full max-w-[19rem] flex-1 flex-col justify-center pb-[9vh] text-left">
      <div className="mb-11 flex justify-center">
        <VoiceMark size={88} />
      </div>

      <div className="w-full">
        <div className="mb-3.5 flex items-center justify-between gap-4 text-base font-medium tracking-[-0.005em] text-foreground">
          <span>{label}</span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {percent === null ? "…" : `${percent}%`}
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-valuetext={
            percent === null ? `${label}, in progress` : `${percent}%`
          }
          aria-busy={percent === null ? true : undefined}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: percent === null ? "0%" : `${percent}%` }}
          />
        </div>
        <p className="mt-3.5 text-sm leading-normal text-muted-foreground">
          {WAIT_EXPECTATION}
        </p>
      </div>
    </div>
  );
}
