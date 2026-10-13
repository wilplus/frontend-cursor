"use client";

import { cn } from "@/lib/utils";
import { WALK_COPY } from "../idealEditCopy";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  WalkFaces — the three judging answers, 👍 Yes · 😐 In-between · 👎 No      */
/*  (founder lock 2026-10-12, moment and feedback chat, section 2.6;          */
/*  prototype v31 `judge`): three full-width tall cards. An answer fills the  */
/*  card's edge black; the others fade once one is given. Other speakers'     */
/*  moments in the walk, and the coach's (section 7: "Coaches move to the     */
/*  same 👍 😐 👎").                                                            */
/* -------------------------------------------------------------------------- */

const FACES: readonly { value: ConfidenceRatingValue; face: string; label: string }[] = [
  { value: "yes", face: "👍", label: WALK_COPY.judgeYes },
  { value: "in_between", face: "😐", label: WALK_COPY.judgeInBetween },
  { value: "no", face: "👎", label: WALK_COPY.judgeNo },
];

export default function WalkFaces({ answered, onPick }: {
  answered: ConfidenceRatingValue | null;
  onPick: (value: ConfidenceRatingValue) => void;
}) {
  return (
    <div data-walk-judgement className="flex min-h-0 flex-1 flex-col gap-2.5">
      {FACES.map((o) => {
        const on = answered === o.value;
        return (
          <button
            key={o.value}
            type="button"
            data-walk-answer={o.value}
            aria-pressed={on}
            disabled={answered !== null}
            onClick={() => onPick(o.value)}
            className={cn(
              "walk-press walk-fill flex max-h-[120px] min-h-[72px] flex-1 items-center gap-[18px] rounded-2xl border-[1.5px] bg-background px-[22px] text-left text-[21px] font-semibold text-foreground",
              on ? "border-foreground" : "border-border",
              answered !== null && !on && "opacity-35",
            )}
          >
            <span aria-hidden="true" className="text-[36px] leading-none">
              {o.face}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Audio unclear", the small grey link under the faces. */
export function WalkUnclear({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      data-walk-answer="audio_unclear"
      onClick={onPick}
      className="walk-press flex h-[34px] w-full items-center justify-center text-[14px] text-muted-foreground"
    >
      {WALK_COPY.judgeUnclear}
    </button>
  );
}
