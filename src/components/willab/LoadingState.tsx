"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { processingTipFrame } from "./processingTipCycle";
import { availableWaitingTips } from "./processingWaitingTips";
import { WAITING_TIPS } from "./waitingTips";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the one full-surface waiting composition                    */
/*                                                                            */
/*  Every whole-screen and overlay wait uses the same sealed presentation:     */
/*  a 64px voice mark, one truthful stage row, a 3px progress rail and one     */
/*  large rotating tip. Real processing supplies real progress; waits without  */
/*  a measurable percentage stay explicitly indeterminate instead of inventing */
/*  progress. Button and other small control feedback remains compact and is   */
/*  intentionally not routed through this full-surface component.              */
/* -------------------------------------------------------------------------- */

/** The breathing voice mark. LoadingState fixes it at 64px; this primitive is
 *  exported only for deliberately compact, in-control status treatments. */
export function VoiceMark({ size }: { size: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: size, width: size }}
      aria-hidden="true"
    >
      <span className="breath-ring absolute inset-0 rounded-full border border-foreground/10" />
      <span
        className="breath-ring absolute rounded-full border border-foreground/15"
        style={{ inset: Math.max(1, Math.round(size * 0.094)), animationDelay: "0.6s" }}
      />
      <span
        className="breath-ring absolute rounded-full border border-primary/30"
        style={{ inset: Math.max(2, Math.round(size * 0.1875)), animationDelay: "1.2s" }}
      />
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <circle
          className="welcome-voice-dot"
          cx="12"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="28"
          cy="28"
          r="6"
          fill="hsl(var(--foreground))"
        />
        <circle
          className="welcome-voice-dot"
          cx="44"
          cy="28"
          r="4"
          fill="hsl(var(--foreground))"
        />
      </svg>
    </div>
  );
}

export interface LoadingPresentationProps {
  /** Truthful lifecycle label. Do not put an estimate here. */
  readonly label: string;
  /** Real percentage, or null when the source exposes no measurable value. */
  readonly percent: number | null;
  /** Stable epoch keeps the tip cycle continuous across presentation remounts. */
  readonly cycleStartedAt?: number | null;
}

/** Presentation-only core shared by generic waits and real processing. */
export function LoadingPresentation({
  label,
  percent: measuredPercent,
  cycleStartedAt = null,
}: LoadingPresentationProps) {
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

export default function LoadingState({
  placement,
  label = "Loading",
  cycleStartedAt = null,
}: {
  /** Viewport owns the screen; surface fills its already-mounted parent. */
  readonly placement: "viewport" | "surface";
  readonly label?: string;
  readonly cycleStartedAt?: number | null;
}) {
  const presentation = (
    <LoadingPresentation
      label={label}
      percent={null}
      cycleStartedAt={cycleStartedAt}
    />
  );

  if (placement === "viewport") {
    return (
      <div className="fixed inset-0 z-40 flex justify-center bg-background px-6">
        {presentation}
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-1 self-stretch justify-center bg-background px-6">
      {presentation}
    </div>
  );
}

/** Small content-region wait. Full screens and overlays must use LoadingState. */
export function SectionLoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[140px] flex-1 items-center justify-center">
      <VoiceMark size={48} />
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
}
