/* -------------------------------------------------------------------------- */
/*  A SPEAKER MAY CHANGE A JUDGEMENT (founder QA1 A, decisions log N51.5;     */
/*  build plan D-FW-9; journey Q3: "the back arrow returns to change it").    */
/*                                                                            */
/*  ‹ back to a moment already answered reopens its judgement with the        */
/*  latest answer pressed. A different answer is saved beside the first      */
/*  (the server keeps the first and answers 200 `revised`); the same answer   */
/*  is no change and sends nothing.                                           */
/*                                                                            */
/*  Only a Confident Voice judgement reopens: a rewrite's answer wrote the    */
/*  Paragraph (L1) and stays final, and praise has nothing to judge. The      */
/*  answer is the speaker's own self-report, never a coach label or machine   */
/*  read (L3), and nothing here counts or numbers anything (AC-9). Pure.      */
/* -------------------------------------------------------------------------- */

import { isConfidentVoiceFeedback } from "./chunkSteps";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  CONFIDENCE_RATING_VALUES,
  type ConfidenceRatingValue,
} from "@/services/api/stateRatings";

/** The judgement to reopen: the moment, and the answer to show pressed. */
export interface ReopenedJudgement {
  item: DocumentSuggestion;
  answer: ConfidenceRatingValue;
}

const FIVE: ReadonlySet<string> = new Set(CONFIDENCE_RATING_VALUES);

/** Can this item's judgement be reopened? A Confident Voice moment the
 *  answer can be saved against; never a rewrite or a praise. */
export function reopensJudgement(item: DocumentSuggestion | null | undefined): boolean {
  return Boolean(
    item && isConfidentVoiceFeedback(item) && item.snippetId && item.takeSessionId,
  );
}

/** The answered moment ‹ reopens on this paragraph, or null. A paragraph
 *  whose judgement still waits opens the question as always; a saved
 *  paragraph is a Next screen, judged nothing until its words are deleted
 *  (founder lock 2026-09-30, B8). */
export function reopenableMoment(
  state: { pending: readonly DocumentSuggestion[]; decided: readonly DocumentSuggestion[] },
  saved: boolean,
): DocumentSuggestion | null {
  if (saved || state.pending.some(isConfidentVoiceFeedback)) return null;
  return state.decided.find(reopensJudgement) ?? null;
}

/** The speaker's latest answer on this moment, when it is one of the five
 *  (the moment read gives the latest, `owner_answers`). */
export function latestAnswerOf(
  feedbackId: string,
  answers: readonly { feedbackId: string; response: string }[],
): ConfidenceRatingValue | null {
  const response = answers.find((a) => a.feedbackId === feedbackId)?.response;
  return response && FIVE.has(response) ? (response as ConfidenceRatingValue) : null;
}

/** The reopened judgement a sheet may draw: a Confident Voice moment only. */
export function reopenedJudgement(
  reopen: ReopenedJudgement | null | undefined,
): ReopenedJudgement | null {
  return reopen && reopensJudgement(reopen.item) ? reopen : null;
}

/** Is this tap a new answer to save? Always on a first judgement; on a
 *  reopened one only when it differs from the answer shown pressed. */
export function answerChanged(
  reopen: ReopenedJudgement | null,
  value: ConfidenceRatingValue,
): boolean {
  return reopen === null || reopen.answer !== value;
}
