"use client";

import { cn } from "@/lib/utils";
import {
  canTap,
  nextSelection,
  selectionLength,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  WalkWordPicker — the helper-words picker, filling the screen (founder     */
/*  lock 2026-10-12, moment and feedback chat, sections 2.3 and 9; prototype  */
/*  v31 `.picker`): a 1.5px border, 24px corners, padding 18px 16px; "Tap the */
/*  words" on the left and the count on the right, 13px uppercase; big plain  */
/*  words at 25px with no borders, the chosen ones orange at 600.             */
/*                                                                            */
/*  ONE RULE FOR EVERY PICKER (build plan D-IT-5; N51.5 QA4 A, N63 Q-B5 A):    */
/*  `nextSelection` — each tap adds one word next to the others, up to the    */
/*  cap, so the pick is always one connected phrase. A word a tap cannot      */
/*  reach is greyed and does nothing.                                         */
/* -------------------------------------------------------------------------- */

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
    <div
      data-walk-word-picker
      className="flex min-h-0 flex-1 flex-col gap-3.5 rounded-[24px] border-[1.5px] border-border px-4 py-[18px]"
    >
      <div className="flex justify-between text-[13px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{COPY.cardTapWords}</span>
        <span>{COPY.emphasisCount(selectionLength(selection))}</span>
      </div>
      <div className="flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto text-[25px] leading-[1.3]">
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
                "walk-press-sm walk-fill rounded-[10px] p-1.5",
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
