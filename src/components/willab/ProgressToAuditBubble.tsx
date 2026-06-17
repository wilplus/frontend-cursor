"use client";

import { useEffect, useState } from "react";
import {
  fetchRecordingProgress,
  audioRemainingLabel,
  progressFraction,
  type RecordingProgress,
} from "@/services/api/recordingProgress";

/* -------------------------------------------------------------------------- */
/*  ProgressToAuditBubble — progress toward the first audit (C-2 / B-3)        */
/*                                                                            */
/*  An ordinary thread bubble shown after a training is sent: a bar toward the   */
/*  10-min (600s) cumulative recording threshold (S2). The figure comes straight */
/*  from the BE total — we never sum snippet durations. Hides entirely until the  */
/*  BE ships /recording-progress (fetch → null → render nothing). Carries the     */
/*  B-3 "What is the audit?" disclosure inline.                                  */
/* -------------------------------------------------------------------------- */

// B-3 — locked copy (audit explainer).
const AUDIT_EXPLAINER =
  "It's a summary of your strong sides and the moments to work on. It's the first historical document of your journey as a public speaker, and we'll send it to you by email.";

export default function ProgressToAuditBubble({
  onOpenAudit,
  progress: initialProgress,
}: {
  onOpenAudit: () => void;
  /** Seed value from the upload response — skips the fetch when provided. */
  progress?: RecordingProgress | null;
}) {
  const [progress, setProgress] = useState<RecordingProgress | null>(
    initialProgress ?? null
  );
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    if (initialProgress !== undefined) return; // already seeded from upload
    let active = true;
    void fetchRecordingProgress().then((p) => {
      if (active) setProgress(p);
    });
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Degrade: no endpoint / unparseable → render nothing (no empty bubble).
  if (!progress) return null;

  const remaining = audioRemainingLabel(progress);
  const pct = Math.round(progressFraction(progress) * 100);

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
      {progress.unlocked ? (
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
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
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
