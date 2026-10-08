"use client";

import { useCallback, useRef, useState } from "react";
import { WALK_COPY } from "../idealEditCopy";
import { PRIMARY_RATING_OPTIONS, SECONDARY_RATING_OPTIONS } from "../ConfidenceLabelChips";
import type { WalkDir } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";
import {
  afterJudging,
  unansweredJudgements,
  type FeedbackWalkMoment,
} from "@/lib/willab/feedbackWalkModel";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  The judging part of the walk, live (build plan D-FW-18; founder lock       */
/*  2026-10-06, flow 9-10; WQ4 A, Q-B6 A; QA1 A).                              */
/*                                                                            */
/*    answer   the speaker's own answer on a moment (L3), after WalkJudgement */
/*             has held it 0.28 s: handed to the host with the answer given   */
/*             earlier in this walk, so a change is saved beside the first    */
/*             and the same answer sends nothing (changeJudgement.ts); then   */
/*             the walk moves on and the toast says the answer with a tick.   */
/*             ‹ back to a judgement draws the earlier answer pressed.       */
/*    skip     Skip on "Judgement time!": every judgement still unanswered is */
/*             handed to the host, which settles it as skipped so its bar     */
/*             clears; then the walk goes on past the judging (Q-B6 A: to     */
/*             sharing once it is drawn, D-FW-20; the end card until then).   */
/*    journal  the Journal post over the intro, and back.                     */
/*                                                                            */
/*  A guest's answer opens sign-up and writes nothing (N32.5); a guest's Skip */
/*  moves on and writes nothing. No number is kept or drawn (AC-9).           */
/* -------------------------------------------------------------------------- */

/** One judgement for the host to save. */
export type WalkJudgementSave<R> = {
  item: R;
  answer: ConfidenceRatingValue;
  /** The answer given to this moment earlier in this walk; null: the first. */
  earlier: ConfidenceRatingValue | null;
};

const LABELS: ReadonlyMap<string, string> = new Map(
  [...PRIMARY_RATING_OPTIONS, ...SECONDARY_RATING_OPTIONS].map((o) => [o.value, o.label]),
);

/** The answer toast (WQ4 A): the chosen answer's own word, with a tick. */
export const answerToastOf = (answer: ConfidenceRatingValue): string =>
  WALK_COPY.answerToast(LABELS.get(answer) ?? "");

export type WalkJudging = {
  answers: Readonly<Record<number, ConfidenceRatingValue>>;
  /** Remounts a judgement a guest tapped, so nothing stays pressed. */
  nonce: number;
  toast: { seq: number; text: string } | null;
  clearToast: () => void;
  journalOpen: boolean;
  openJournal: () => void;
  closeJournal: () => void;
  answer: (step: WalkStep, moment: FeedbackWalkMoment<unknown>, value: ConfidenceRatingValue) => void;
  skip: (step: WalkStep) => void;
  reset: () => void;
};

export function useWalkJudging<R>(args: {
  plan: readonly WalkStep[];
  moments: readonly FeedbackWalkMoment<R>[];
  guest: boolean;
  blocked: (step: WalkStep) => boolean;
  forward: () => void;
  land: (steps: readonly WalkStep[], to: number, how: WalkDir | undefined) => void;
  onJudge?: (save: WalkJudgementSave<R>) => void;
  onSkipJudging?: (items: R[]) => void;
}): WalkJudging {
  const live = useRef(args);
  live.current = args;
  const [answers, setAnswers] = useState<Record<number, ConfidenceRatingValue>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [nonce, setNonce] = useState(0);
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  const answer = useCallback(
    (step: WalkStep, moment: FeedbackWalkMoment<unknown>, value: ConfidenceRatingValue) => {
      const { blocked, forward, onJudge, moments } = live.current;
      if (blocked(step)) {
        setNonce((n) => n + 1);
        return;
      }
      const earlier = answersRef.current[moment.index] ?? null;
      const item = moments[moment.index]?.judgeItem ?? null;
      setAnswers((a) => ({ ...a, [moment.index]: value }));
      if (item !== null) onJudge?.({ item, answer: value, earlier });
      setToast((t) => ({ seq: (t?.seq ?? 0) + 1, text: answerToastOf(value) }));
      forward();
    },
    [],
  );

  const skip = useCallback((step: WalkStep) => {
    const { plan, moments, guest, land, onSkipJudging } = live.current;
    if (!guest && !step.readOnly) {
      const items: R[] = [];
      for (const m of unansweredJudgements(plan, answersRef.current)) {
        const item = moments[m]?.judgeItem;
        if (item != null) items.push(item);
      }
      if (items.length > 0) onSkipJudging?.(items);
    }
    land(plan, afterJudging(plan), "forward");
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
    setToast(null);
    setJournalOpen(false);
  }, []);

  return {
    answers,
    nonce,
    toast,
    clearToast: useCallback(() => setToast(null), []),
    journalOpen,
    openJournal: useCallback(() => setJournalOpen(true), []),
    closeJournal: useCallback(() => setJournalOpen(false), []),
    answer,
    skip,
    reset,
  };
}
