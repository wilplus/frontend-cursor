"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 4 · Words (founder 2026-09-30, A3, A4; build plan P2-11).            */
/*                                                                            */
/*  The words the coach says to the speaker: an instruction, a praise line, a  */
/*  clearer version or a note, by kind. The model's draft sits in the field   */
/*  when there is one; the coach edits every word; "Start from blank" is the  */
/*  way out. The passage the speaker will say is shown, never edited. The     */
/*  draft is kept beside the final by the backend; the pair is written when   */
/*  the answer resolves.                                                       */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import type { AnswerPlan } from "@/lib/willab/coachAnswer";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

export type DraftState =
  | { status: "drafting" }
  | { status: "drafted"; text: string }
  | { status: "none" };

export default function CoachWordsSheet({
  plan,
  pager,
  pseudonym,
  passage,
  draft,
  value,
  onChange,
  onClose,
  onNext,
}: {
  plan: AnswerPlan;
  pager: Pager;
  pseudonym: string;
  /** The passage the speaker will say; empty outside a moment (the library). */
  passage: string;
  draft: DraftState;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  onNext: () => void;
}) {
  const [blank, setBlank] = useState(false);
  const drafted = draft.status === "drafted";

  // The draft lands in the field once, when it arrives, unless the coach
  // already typed or chose a blank page.
  useEffect(() => {
    if (draft.status === "drafted" && !blank && value === "") onChange(draft.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.status]);

  const eyebrow = draft.status === "drafting"
    ? COPY.wordsEyebrowDrafting
    : drafted && !blank ? (passage ? COPY.wordsEyebrowDrafted : COPY.laneEyebrowDrafted)
    : COPY.wordsEyebrowBlank;

  return (
    <SheetFrame
      title={plan.wordsTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={
        <div className="flex flex-col gap-0.5">
          <button type="button" className={PILL} disabled={!value.trim()} onClick={onNext}>
            {COPY.pillNextNoVideo}
          </button>
          {drafted && !blank ? (
            <button type="button" className={LINK} onClick={() => { setBlank(true); onChange(""); }}>
              {COPY.linkStartBlank}
            </button>
          ) : drafted && blank ? (
            <button type="button" className={LINK} onClick={() => { setBlank(false); onChange(draft.text); }}>
              {COPY.linkUseDraft}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="coach-words-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </span>
        {draft.status === "none" && !passage ? null : draft.status === "none" ? (
          <p className="text-[13px] text-muted-foreground">{COPY.wordsDraftUnavailable}</p>
        ) : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={COPY.wordsPlaceholder}
          rows={6}
          data-testid="coach-words-field"
          className="min-h-[150px] w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] leading-[1.5] text-foreground outline-none focus:border-foreground/40"
        />
        {passage ? (
          <div className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/5 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {COPY.wordsPassage(pseudonym)}
            </span>
            <p className="font-serif text-[15px] leading-[1.5] text-foreground">{passage}</p>
          </div>
        ) : null}
      </div>
    </SheetFrame>
  );
}
