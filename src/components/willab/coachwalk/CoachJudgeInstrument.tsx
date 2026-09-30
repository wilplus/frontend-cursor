"use client";

/* -------------------------------------------------------------------------- */
/*  The one instrument (founder 2026-09-30, A1, B6, B9): the clip and the      */
/*  five answers with the coach's words. The Judge sheet renders it in the    */
/*  walk; the corpus workbench renders it on its labelling screen, so one     */
/*  instrument exists in the product (CONSTRUCT: one question, one place).   */
/*                                                                            */
/*  Keys 1 to 5 answer it (P2-14) when the host says the sheet is on screen;  */
/*  a text field keeps its own keys.                                          */
/* -------------------------------------------------------------------------- */

import { useEffect } from "react";
import ConfidenceLabelChips from "../ConfidenceLabelChips";
import ConfidenceEvidenceReadout from "../ConfidenceEvidenceReadout";
import MediaPlayer from "@/components/results/MediaPlayer";
import { CONFIDENCE_RATING_VALUES, type ConfidenceRatingValue } from "@/services/api/stateRatings";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export interface JudgeClip {
  src: string | null;
  startOffsetMs: number;
  durationMs: number;
}

/** The answer a number key means: 1 Yes, 2 In-between, 3 No, 4 Not sure,
 *  5 Audio unclear, in the order the pills sit. */
export function answerForKey(key: string): ConfidenceRatingValue | null {
  const index = Number.parseInt(key, 10) - 1;
  return index >= 0 && index < CONFIDENCE_RATING_VALUES.length ? CONFIDENCE_RATING_VALUES[index] : null;
}

function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || Boolean(el?.isContentEditable);
}

export default function CoachJudgeInstrument({
  clip,
  value,
  unrateable = false,
  saving,
  disabled = false,
  error,
  onPick,
  transcript,
  transcriptRevealed = false,
  keys = false,
}: {
  clip: JudgeClip | null;
  value: ConfidenceRatingValue | null;
  unrateable?: boolean;
  saving: boolean;
  disabled?: boolean;
  error: string | null;
  onPick: (value: ConfidenceRatingValue) => void;
  /** The corpus reveals the exact words after the label; the walk's Read
   *  screen does that instead, so the sheet passes none. */
  transcript?: string;
  transcriptRevealed?: boolean;
  /** Keys 1 to 5 pick an answer while mounted. */
  keys?: boolean;
}) {
  useEffect(() => {
    if (!keys) return;
    function onKey(event: KeyboardEvent): void {
      if (disabled || saving || event.metaKey || event.ctrlKey || event.altKey) return;
      if (inTextField(event.target)) return;
      const answer = answerForKey(event.key);
      if (!answer) return;
      event.preventDefault();
      onPick(answer);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, disabled, saving, onPick]);

  return (
    <div className="flex flex-col gap-4" data-testid="coach-judge-instrument">
      {transcript !== undefined ? (
        <ConfidenceEvidenceReadout
          audioRef={clip?.src ?? null}
          startOffsetMs={clip?.startOffsetMs ?? 0}
          durationMs={clip?.durationMs ?? 0}
          transcript={transcript}
          transcriptRevealed={transcriptRevealed}
        />
      ) : clip?.src ? (
        <MediaPlayer src={clip.src} startOffsetMs={clip.startOffsetMs} durationMs={clip.durationMs} compact />
      ) : null}
      <ConfidenceLabelChips
        question={COPY.judgeQuestion}
        value={value}
        unrateable={unrateable}
        saving={saving}
        disabled={disabled || saving}
        error={error}
        ownerWording
        eyebrow={
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
            {COPY.judgeEyebrow}
          </span>
        }
        onPick={onPick}
      />
    </div>
  );
}
