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
/*                                                                            */
/*  ONE SCREEN, TWO HOSTS (B9; build plan P2-16). JudgeFrame is the screen    */
/*  (the sheet, the ‹ position › bar, the title); the walk puts the one       */
/*  instrument in it here, and the corpus workbench puts the same instrument */
/*  in it for an imported piece, with its own save. Nothing else frames a     */
/*  confidence judgement in the product.                                      */
/*                                                                            */
/*  THE CHAIN (founder 2026-10-05, N48.5 Q27 A). On the walk the same answer */
/*  is also the confidence chain's blind judgement: useConfidenceChainReceipt */
/*  asks for the chain's packet when the clip is on screen and receipts the   */
/*  paint, and the save echoes it. Invisible: the coach sees nothing new, and */
/*  without a packet the save is exactly what it was.                         */
/* -------------------------------------------------------------------------- */

import { useState, type ReactNode } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import CoachJudgeInstrument, { type JudgeClip } from "./CoachJudgeInstrument";
import { buildRatingBody, saveStateRating, type ConfidenceRatingValue } from "@/services/api/stateRatings";
import { useConfidenceChainReceipt } from "./useConfidenceChainReceipt";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

export type { JudgeClip } from "./CoachJudgeInstrument";

/** The Judge screen around its content: the speaker's sheet with the coach's
 *  title and the walk's ‹ position › bar. */
export function JudgeFrame({
  pager,
  onClose,
  railed = false,
  children,
}: {
  /** null draws no bar (nothing to walk yet). */
  pager: Pager | null;
  onClose: () => void;
  /** Leaves room for the desktop rail (P2-14). */
  railed?: boolean;
  children: ReactNode;
}) {
  return (
    <SheetFrame
      title={COPY.judgeTitle}
      onClose={onClose}
      nav={pager ? <FeedbackPagerBar pager={pager} /> : null}
      railed={railed}
    >
      <div className="flex flex-col gap-4" data-testid="coach-judge-sheet">
        {children}
      </div>
    </SheetFrame>
  );
}

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
  const chain = useConfidenceChainReceipt(snippetId, clip !== null);

  async function pick(next: ConfidenceRatingValue): Promise<void> {
    if (saving) return;
    const body = buildRatingBody(next);
    if (!body) return;
    setValue(next);
    setSaving(true);
    setError(null);
    const result = await saveStateRating(snippetId, body, null, null, chain.current);
    setSaving(false);
    if (!result.ok) {
      setValue(null);
      setError(result.error ?? COPY.judgeFail);
      return;
    }
    onJudged(next);
  }

  return (
    <JudgeFrame pager={pager} onClose={onClose} railed={railed}>
      <CoachJudgeInstrument
        clip={clip}
        value={value}
        saving={saving}
        error={error}
        onPick={(next) => void pick(next)}
        keys
      />
    </JudgeFrame>
  );
}
