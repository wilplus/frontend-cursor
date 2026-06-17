"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchRecordingProgress,
  audioRemainingLabel,
  progressFraction,
  type RecordingProgress,
} from "@/services/api/recordingProgress";
import {
  fetchBestPresentationProgress,
  type BestPresentationProgress,
} from "@/services/api/bestPresentation";
import { readExploreArc } from "@/lib/willab/exploreArc";

/* -------------------------------------------------------------------------- */
/*  ProgressToAuditBubble — progress toward the arc deliverable (C-2 / F3)   */
/*                                                                            */
/*  Two modes, chosen on mount by checking localStorage for an active arc:    */
/*                                                                            */
/*  Arc mode (explore takes in progress):                                     */
/*    Polls GET /api/v2/user/explore/<arc_id>/progress → takes_done / target. */
/*    Shows "X of Y sessions complete" + a fill bar.                          */
/*    When ready → "Your ideal presentation is ready" + "View" button         */
/*    which calls onOpenBestPresentation(arcId).                               */
/*                                                                            */
/*  Legacy mode (no active arc, standalone recording):                        */
/*    Falls back to GET /api/v2/user/recording-progress → cumulative seconds. */
/*    Shows "M:SS of recording left to unlock your first audit" (now dormant  */
/*    — the audit user surface is retired). When unlocked → onOpenAudit().    */
/*                                                                            */
/*  Hides entirely when both sources return null (no endpoint yet / error).   */
/* -------------------------------------------------------------------------- */

// B-3 — locked copy (audit explainer).
const AUDIT_EXPLAINER =
  "It's a summary of your strong sides and the moments to work on. It's the first historical document of your journey as a public speaker, and we'll send it to you by email.";

export default function ProgressToAuditBubble({
  onOpenAudit,
  onOpenBestPresentation,
  progress: initialProgress,
}: {
  onOpenAudit: () => void;
  /** Called when the user taps "View your ideal presentation" in arc mode.
   *  Receives the arcId so the parent can mount the right overlay. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** Seed value from the upload response — skips the fetch when provided. */
  progress?: RecordingProgress | null;
}) {
  // Arc mode — set once on mount from localStorage.
  const arcRef = useRef(readExploreArc());
  const arcId = arcRef.current?.arcId ?? null;

  // Arc-mode progress (takes-based).
  const [arcProgress, setArcProgress] = useState<BestPresentationProgress | null>(null);
  // Legacy-mode progress (seconds-based).
  const [legacyProgress, setLegacyProgress] = useState<RecordingProgress | null>(
    initialProgress ?? null
  );
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    let active = true;
    if (arcId) {
      // Arc mode: poll the per-arc progress endpoint.
      void fetchBestPresentationProgress(arcId).then((p) => {
        if (active) setArcProgress(p);
      });
    } else {
      // Legacy mode: fetch cumulative seconds (if not already seeded).
      if (initialProgress !== undefined) return;
      void fetchRecordingProgress().then((p) => {
        if (active) setLegacyProgress(p);
      });
    }
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // — Arc mode render —
  if (arcId) {
    if (!arcProgress) return null; // no endpoint yet → hide gracefully
    const pct = Math.round((arcProgress.takesDone / arcProgress.takesTarget) * 100);
    return (
      <div className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
        {arcProgress.ready ? (
          <>
            <p className="text-[15px] leading-relaxed text-foreground">
              Your ideal presentation is ready.
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
              View your ideal presentation
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-foreground">
              {arcProgress.takesTarget - arcProgress.takesDone} more session
              {arcProgress.takesTarget - arcProgress.takesDone !== 1 ? "s" : ""}{" "}
              to your ideal presentation.
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to your ideal presentation"
              />
            </div>
            <p className="text-[12px] text-muted-foreground">
              {arcProgress.takesDone} of {arcProgress.takesTarget} sessions
              complete
            </p>
          </>
        )}
      </div>
    );
  }

  // — Legacy mode render —
  if (!legacyProgress) return null;

  const remaining = audioRemainingLabel(legacyProgress);
  const legacyPct = Math.round(progressFraction(legacyProgress) * 100);

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
      {legacyProgress.unlocked ? (
        <>
          <p className="text-[15px] leading-relaxed text-foreground">
            Your first audit is ready.
          </p>
          <button
            type="button"
            onClick={onOpenAudit}
            className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
          >
            View your audit
          </button>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-foreground">
            {remaining
              ? `${remaining} of recording left to unlock your first audit.`
              : "You're almost at your first audit."}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${legacyPct}%` }}
              role="progressbar"
              aria-valuenow={legacyPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to your first audit"
            />
          </div>
        </>
      )}

      {/* B-3 — what is the audit? */}
      <button
        type="button"
        onClick={() => setExplain((v) => !v)}
        className="self-start text-[12px] text-muted-foreground underline-offset-2 hover:underline"
        aria-expanded={explain}
      >
        What is the audit?
      </button>
      {explain ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {AUDIT_EXPLAINER}
        </p>
      ) : null}
    </div>
  );
}
