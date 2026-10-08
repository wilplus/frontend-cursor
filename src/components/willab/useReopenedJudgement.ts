"use client";

import { useCallback, useState } from "react";
import {
  latestAnswerOf,
  reopenableMoment,
  type ReopenedJudgement,
} from "@/lib/willab/changeJudgement";
import type { DocumentSuggestion } from "@/services/api/idealText";
import { useParagraphSheetData } from "./paragraphSheetData";

/** ‹ BACK TO AN ANSWERED MOMENT (founder QA1 A, D-FW-9; journey Q3: "the
 *  back arrow returns to change it"). Decided once, as the sheet opens: when
 *  it was opened by ‹ and its Confident Voice moment is answered, the
 *  judgement reopens with the speaker's latest answer pressed. The answer
 *  comes from the owner-answers read the paragraph sheet already uses (the
 *  latest, server side), held at most as long as that sheet holds it.
 *
 *  `waiting`: the read is still on its way, draw nothing yet. `reopen`: the
 *  judgement to draw, or null (not asked, nothing to reopen, or no answer
 *  known — the paragraph's own sheet opens as before). `done`: the speaker
 *  answered, the reopened judgement is over for this opening. */
export function useReopenedJudgement(args: {
  asked: boolean;
  state: { pending: DocumentSuggestion[]; decided: DocumentSuggestion[] };
  saved: boolean;
  takeSessionId: string | null;
  partId: string;
}): { waiting: boolean; reopen: ReopenedJudgement | null; done: () => void } {
  const { asked, state, saved, takeSessionId, partId } = args;
  const [item] = useState(() => (asked ? reopenableMoment(state, saved) : null));
  const [open, setOpen] = useState(item !== null);
  const done = useCallback(() => setOpen(false), []);
  // Only the answers are read (no arc: no history fetch); nothing at all
  // when there is nothing to reopen.
  const data = useParagraphSheetData(null, open ? takeSessionId : null, partId);
  if (!open || item === null) return { waiting: false, reopen: null, done };
  if (data === null) return { waiting: true, reopen: null, done };
  const answer = latestAnswerOf(item.id, data.answers);
  return { waiting: false, reopen: answer ? { item, answer } : null, done };
}
