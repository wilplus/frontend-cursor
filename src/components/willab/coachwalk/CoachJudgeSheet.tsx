"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 2 · Judge (founder 2026-09-30, A1; build plan P2-9).                 */
/*                                                                            */
/*  The speaker's Feedback sheet with the coach's words: the same frame        */
/*  (SheetFrame), the same ‹ position › bar (FeedbackPagerBar), the same clip  */
/*  card (MediaPlayer, compact) and the same five pills (ConfidenceLabelChips,  */
/*  owner wording). What differs is only what the design lists: the pseudonym  */
/*  in the header, the title, the eyebrow, and the question's subject.         */
/*                                                                            */
/*  BLIND COACH: nothing but the clip and the question is on this screen, and  */
/*  nothing renders under the question until the save returns. The passage,   */
/*  the speaker's answer, the kind and what fired are the next screen's, and  */
/*  the backend withholds them until this rating is saved.                    */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import ConfidenceLabelChips from "../ConfidenceLabelChips";
import MediaPlayer from "@/components/results/MediaPlayer";
import { buildRatingBody, saveStateRating, type ConfidenceRatingValue } from "@/services/api/stateRatings";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export interface JudgeClip {
  src: string | null;
  startOffsetMs: number;
  durationMs: number;
}

export default function CoachJudgeSheet({
  snippetId,
  pager,
  clip,
  onClose,
  onJudged,
}: {
  snippetId: string;
  pager: Pager;
  clip: JudgeClip | null;
  onClose: () => void;
  /** The rating is saved; the walk moves to Read on its own. */
  onJudged: (value: ConfidenceRatingValue) => void;
}) {
  const [value, setValue] = useState<ConfidenceRatingValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: ConfidenceRatingValue): Promise<void> {
    if (saving) return;
    const body = buildRatingBody(next);
    if (!body) return;
    setValue(next);
    setSaving(true);
    setError(null);
    const result = await saveStateRating(snippetId, body);
    setSaving(false);
    if (!result.ok) {
      setValue(null);
      setError(result.error ?? COPY.judgeFail);
      return;
    }
    onJudged(next);
  }

  return (
    <SheetFrame
      title={COPY.judgeTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
    >
      <div className="flex flex-col gap-4" data-testid="coach-judge-sheet">
        {clip?.src ? (
          <MediaPlayer
            src={clip.src}
            startOffsetMs={clip.startOffsetMs}
            durationMs={clip.durationMs}
            compact
          />
        ) : null}
        <ConfidenceLabelChips
          question={COPY.judgeQuestion}
          value={value}
          saving={saving}
          disabled={saving}
          error={error}
          ownerWording
          eyebrow={
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
              {COPY.judgeEyebrow}
            </span>
          }
          onPick={(next) => void pick(next)}
        />
      </div>
    </SheetFrame>
  );
}
