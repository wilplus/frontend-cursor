"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBestPresentationProgress,
  type BestPresentationProgress,
} from "@/services/api/bestPresentation";
import { readExploreArc } from "@/lib/willab/exploreArc";

/* -------------------------------------------------------------------------- */
/*  ProgressToAuditBubble — progress toward the arc deliverable (C-2 / F1)   */
/*                                                                            */
/*  Arc mode only (explore takes in progress):                                */
/*    Polls GET /api/v2/explore/arc/<arc_id>/progress → takes_done / target.  */
/*    ready === false → "Your best presentation needs N more takes — min 3."  */
/*                     + "Record next take" CTA (calls onStartNextTake).      */
/*    ready === true  → "Your best presentation is ready." + view button.     */
/*                                                                            */
/*  Hides entirely when there is no active arc (no localStorage entry) or     */
/*  when the progress endpoint returns null (not shipped yet / error).        */
/*                                                                            */
/*  The legacy seconds-based audit progress path is retired — the audit       */
/*  deliverable no longer surfaces to users.                                  */
/* -------------------------------------------------------------------------- */

export default function ProgressToAuditBubble({
  onOpenAudit,
  onOpenBestPresentation,
  onOpenBreakthroughs,
  onStartNextTake,
}: {
  /** Fallback when onOpenBestPresentation is absent. */
  onOpenAudit: () => void;
  /** Called when the user taps "View your best presentation" in arc mode.
   *  Receives the arcId so the parent can mount the right overlay. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** #5 — opens the arc's coach-confirmed breakthrough moments. */
  onOpenBreakthroughs?: (arcId: string) => void;
  /** Opens the recording overlay for the next explore take. */
  onStartNextTake?: () => void;
}) {
  // Arc mode — set once on mount from localStorage.
  const arcRef = useRef(readExploreArc());
  const arcId = arcRef.current?.arcId ?? null;

  const [arcProgress, setArcProgress] = useState<BestPresentationProgress | null>(null);

  useEffect(() => {
    if (!arcId) return;
    let active = true;
    const load = () => {
      void fetchBestPresentationProgress(arcId).then((p) => {
        // Keep the last good value on a transient null (network blip) so the
        // bubble never flickers away once shown.
        if (active && p) setArcProgress(p);
      });
    };
    load();
    // Refetch when the user returns to the tab / app (e.g. after recording a
    // take in the lab overlay) so the bubble flips to "ready" without a reload.
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [arcId]);

  if (!arcId || !arcProgress) return null;

  const pct = Math.round((arcProgress.takesDone / arcProgress.takesTarget) * 100);

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
      {arcProgress.ready ? (
        <>
          <p className="text-[15px] leading-relaxed text-foreground">
            Your best presentation is ready.
          </p>
          <button
            type="button"
            onClick={() =>
              onOpenBestPresentation
                ? onOpenBestPresentation(arcId)
                : onOpenAudit()
            }
            className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
          >
            View your best presentation
          </button>
          {onOpenBreakthroughs ? (
            <button
              type="button"
              onClick={() => onOpenBreakthroughs(arcId)}
              className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
            >
              View your breakthrough moments
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-foreground">
            Your best presentation needs {arcProgress.takesRemaining} more{" "}
            {arcProgress.takesRemaining === 1 ? "take" : "takes"}, minimum 3.
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to your best presentation"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">
            {arcProgress.takesDone} of {arcProgress.takesTarget} takes done
          </p>
          {onStartNextTake ? (
            <button
              type="button"
              onClick={onStartNextTake}
              className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
            >
              Record next take
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
