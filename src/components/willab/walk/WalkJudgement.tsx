"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import { PRIMARY_RATING_OPTIONS, SECONDARY_RATING_OPTIONS } from "../ConfidenceLabelChips";

/* -------------------------------------------------------------------------- */
/*  WalkJudgement — the one judgement screen (founder lock 2026-10-06)         */
/*                                                                            */
/*  The one question and the shared answer vocabulary: Yes, In-between, No,    */
/*  then "Not sure" and "Audio unclear" smaller below. A chosen answer fills   */
/*  black, holds WALK_ANSWER_HOLD_MS, then calls onAnswer — the host moves on  */
/*  with the toast. The speaker's own answer, never the machine's (L3); no    */
/*  number anywhere (AC-9). The coach's instrument (ConfidenceLabelChips) is  */
/*  not restyled: it is the blind lane's and keeps its own look.              */
/* -------------------------------------------------------------------------- */

type Option = { value: ConfidenceRatingValue; label: string };

function Answer({
  option,
  small,
  chosen,
  onPick,
}: {
  option: Option;
  small: boolean;
  chosen: boolean;
  onPick: (value: ConfidenceRatingValue) => void;
}) {
  return (
    <button
      type="button"
      data-walk-answer={option.value}
      data-size={small ? "small" : "main"}
      aria-pressed={chosen}
      onClick={() => onPick(option.value)}
      className={cn(
        "walk-press w-full rounded-full border-[1.5px] text-center",
        small ? "p-[9px] text-[14px] font-medium" : "p-3.5 text-[16px] font-semibold",
        chosen
          ? "border-foreground bg-foreground text-background"
          : cn("border-foreground/15", small ? "text-muted-foreground" : "text-foreground"),
      )}
    >
      {option.label}
    </button>
  );
}

export default function WalkJudgement({
  question = COPY.confidenceQuestion,
  primary = PRIMARY_RATING_OPTIONS,
  value = null,
  onAnswer,
  holdMs = WALK_ANSWER_HOLD_MS,
}: {
  question?: string;
  /** The three main answers' words; the speaker's by default. The coach
   *  panel passes the coach's ("Yes — Confident"), same values, same order. */
  primary?: readonly Option[];
  /** An answer already given, drawn filled (a return to this screen). */
  value?: ConfidenceRatingValue | null;
  onAnswer: (value: ConfidenceRatingValue) => void;
  holdMs?: number;
}) {
  const [chosen, setChosen] = useState<ConfidenceRatingValue | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const shown = chosen ?? value;
  const pick = (answer: ConfidenceRatingValue) => {
    if (chosen) return; // held: one answer per visit
    setChosen(answer);
    timer.current = window.setTimeout(() => onAnswer(answer), holdMs);
  };

  return (
    <div data-walk-judgement className="contents">
      <p className="m-0 text-[16px] font-semibold">{question}</p>
      <div className="flex flex-col gap-2">
        {primary.map((option) => (
          <Answer key={option.value} option={option} small={false} chosen={shown === option.value} onPick={pick} />
        ))}
        <div className="mt-0.5 flex gap-2">
          {SECONDARY_RATING_OPTIONS.map((option) => (
            <Answer key={option.value} option={option} small chosen={shown === option.value} onPick={pick} />
          ))}
        </div>
      </div>
    </div>
  );
}
