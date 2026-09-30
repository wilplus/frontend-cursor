"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 2 · Judge (founder 2026-09-30, A1; build plan P2-9).                 */
/*                                                                            */
/*  The speaker's Feedback sheet with the coach's words: the same frame        */
/*  (SheetFrame), the same ‹ position › bar (FeedbackPagerBar), and the one   */
/*  instrument (CoachJudgeInstrument: the clip card and the five pills). What */
/*  differs is only what the design lists: the pseudonym in the header, the   */
/*  title, the eyebrow, and the question's subject.                            */
/*                                                                            */
/*  BLIND COACH: nothing but the clip and the question is on this screen, and  */
/*  nothing renders under the question until the save returns. The passage,   */
/*  the speaker's answer, the kind and what fired are the next screen's, and  */
/*  the backend withholds them until this rating is saved.                    */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import CoachJudgeInstrument, { type JudgeClip } from "./CoachJudgeInstrument";
import { buildRatingBody, saveStateRating, type ConfidenceRatingValue } from "@/services/api/stateRatings";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export type { JudgeClip } from "./CoachJudgeInstrument";

export default function CoachJudgeSheet({
  snippetId,
  pager,
  clip,
  onClose,
  onJudged,
  railed = false,
}: {
  snippetId: string;
  pager: Pager;
  clip: JudgeClip | null;
  onClose: () => void;
  /** The rating is saved; the walk moves to Read on its own. */
  onJudged: (value: ConfidenceRatingValue) => void;
  /** Leaves room for the desktop rail (P2-14). */
  railed?: boolean;
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
      railed={railed}
    >
      <div className="flex flex-col gap-4" data-testid="coach-judge-sheet">
        <CoachJudgeInstrument
          clip={clip}
          value={value}
          saving={saving}
          error={error}
          onPick={(next) => void pick(next)}
          keys
        />
      </div>
    </SheetFrame>
  );
}
