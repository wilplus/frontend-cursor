"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { processingTipFrame } from "./processingTipCycle";
import { availableWaitingTips } from "./processingWaitingTips";
import { WAITING_TIPS } from "./waitingTips";
import { VoiceMark } from "./LoadingState";

/* -------------------------------------------------------------------------- */
/*  RecordingAnalysisPresentation — post-recording analysis, and only that.   */
/*                                                                            */
/*  This is the single richer waiting state: real pipeline stage, real          */
/*  percentage, orange progress rail, and rotating recommendations. Generic    */
/*  route/auth/data waits use LoadingState and therefore cannot inherit this    */
/*  analysis-only information architecture by accident.                        */
/* -------------------------------------------------------------------------- */

export interface RecordingAnalysisPresentationProps {
  /** Truthful lifecycle label supplied by the recording-analysis pipeline. */
  readonly label: string;
  /** Real percentage, or null while the pipeline exposes no measurable value. */
  readonly percent: number | null;
  /** Stable epoch keeps the tip cycle continuous across overlay remounts. */
  readonly cycleStartedAt?: number | null;
}

export default function RecordingAnalysisPresentation({
  label,
  percent: measuredPercent,
  cycleStartedAt = null,
}: RecordingAnalysisPresentationProps) {
  const waitingTips = useMemo(() => availableWaitingTips(WAITING_TIPS), []);
  const localCycleRef = useRef<number | null>(null);
  if (localCycleRef.current === null) localCycleRef.current = Date.now();
  const cycleEpoch =
    typeof cycleStartedAt === "number" && Number.isFinite(cycleStartedAt)
      ? cycleStartedAt
      : localCycleRef.current;
  const motionReduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [tipFrame, setTipFrame] = useState(() =>
    motionReduced()
      ? { index: 0, visible: true }
      : processingTipFrame(Date.now(), cycleEpoch, waitingTips.length),
  );

  useEffect(() => {
    if (waitingTips.length < 2 || motionReduced()) {
      setTipFrame({ index: 0, visible: true });
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const syncToEpoch = () => {
      const next = processingTipFrame(Date.now(), cycleEpoch, waitingTips.length);
      setTipFrame((current) =>
        current.index === next.index && current.visible === next.visible
          ? current
          : { index: next.index, visible: next.visible },
      );
      timer = setTimeout(syncToEpoch, next.nextDelayMs);
    };
    syncToEpoch();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cycleEpoch, waitingTips.length]);

  const percent =
    typeof measuredPercent === "number" && Number.isFinite(measuredPercent)
      ? Math.max(0, Math.min(100, measuredPercent))
      : null;
  const tip = waitingTips[tipFrame.index % waitingTips.length];

  return (
    <div className="flex w-full max-w-[34rem] flex-1 flex-col justify-center pb-[12vh] text-left">
      <div className="mb-10 flex justify-center">
        <VoiceMark size={64} />
      </div>

      <div className="mb-14 w-full">
        <div className="mb-4 flex items-center justify-between gap-4 text-[0.95rem] font-medium text-foreground">
          <span>{label}</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {percent === null ? "…" : `${percent}%`}
          </span>
        </div>
        <div
          className="h-[3px] overflow-hidden bg-border"
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
            className="h-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: percent === null ? "0%" : `${percent}%` }}
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        <p className="mb-6 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          While you wait
        </p>
        <p
          className={`text-balance text-[clamp(1.45rem,5.2vw,2.05rem)] font-medium leading-[1.28] tracking-[-0.015em] text-foreground transition-opacity duration-[420ms] ease-out motion-reduce:transition-none ${
            tipFrame.visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {tip}
        </p>
      </div>
    </div>
  );
}
