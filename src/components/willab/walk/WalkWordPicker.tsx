"use client";

import { cn } from "@/lib/utils";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  WalkWordPicker — the helper-words picker inside the plain white box        */
/*  (founder lock 2026-10-06; helper-words lock B3: at most four words).      */
/*  "Tap the words" on the left, how many of the four on the right; a picked  */
/*  word takes the orange picker highlight, fading in.                        */
/* -------------------------------------------------------------------------- */

export const WALK_MAX_HELPER_WORDS = 4;

/** Pure: the picked word indices after tapping `index`. */
export function toggleHelperWord(picked: readonly number[], index: number): number[] {
  if (picked.includes(index)) return picked.filter((i) => i !== index);
  if (picked.length >= WALK_MAX_HELPER_WORDS) return [...picked];
  return [...picked, index];
}

export default function WalkWordPicker({
  words,
  picked,
  onChange,
}: {
  words: readonly string[];
  picked: readonly number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <div data-walk-word-picker className="flex flex-col gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-3">
      <div className="flex justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{COPY.cardTapWords}</span>
        <span>{COPY.emphasisCount(picked.length)}</span>
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-[18px] leading-[1.35]">
        {words.map((word, index) => {
          const on = picked.includes(index);
          return (
            <button
              key={`${index}-${word}`}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleHelperWord(picked, index))}
              className={cn(
                "walk-press-sm walk-fill rounded-[7px] px-[5px] py-1.5",
                on && "bg-primary/[0.07] font-semibold text-primary",
              )}
            >
              {word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
