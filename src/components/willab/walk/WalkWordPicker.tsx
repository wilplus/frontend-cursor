"use client";

import { cn } from "@/lib/utils";
import {
  canTap,
  HELPER_WORDS_MAX,
  nextSelection,
  selectionLength,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  WalkWordPicker — the helper-words picker inside the plain white box        */
/*  (founder lock 2026-10-06; helper-words lock B3: at most four words).      */
/*  "Tap the words" on the left, how many of the four on the right; a picked  */
/*  word takes the orange picker highlight, fading in.                        */
/*                                                                            */
/*  ONE RULE FOR EVERY PICKER (build plan D-IT-5; N51.5 QA4 A, N63 Q-B5 A):    */
/*  `nextSelection` — each tap adds one word next to the others, up to four,  */
/*  so the pick is always one connected phrase. A word a tap cannot reach is  */
/*  greyed and does nothing.                                                  */
/* -------------------------------------------------------------------------- */

export const WALK_MAX_HELPER_WORDS = HELPER_WORDS_MAX;

export default function WalkWordPicker({
  words,
  selection,
  onChange,
}: {
  words: readonly string[];
  selection: PhraseSelection | null;
  onChange: (next: PhraseSelection | null) => void;
}) {
  return (
    <div data-walk-word-picker className="flex flex-col gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-3">
      <div className="flex justify-between text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{COPY.cardTapWords}</span>
        <span>{COPY.emphasisCount(selectionLength(selection))}</span>
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-[18px] leading-[1.35]">
        {words.map((word, index) => {
          const on = selection !== null && index >= selection.from && index <= selection.to;
          const reachable = canTap(selection, index);
          return (
            <button
              key={`${index}-${word}`}
              type="button"
              aria-pressed={on}
              aria-disabled={!reachable}
              onClick={() => {
                if (reachable) onChange(nextSelection(selection, index));
              }}
              className={cn(
                "walk-press-sm walk-fill rounded-[7px] px-[5px] py-1.5",
                on && "bg-primary/[0.07] font-semibold text-primary",
                !on && !reachable && "text-muted-foreground/50",
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
