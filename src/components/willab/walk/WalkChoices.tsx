"use client";

import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  WalkChoices — one list of choices (founder lock 2026-10-06, the coach     */
/*  panel redrawn: "One action per screen. Buttons with different jobs never  */
/*  look alike").                                                             */
/*                                                                            */
/*  Every card is white with the thin edge (founder 2026-10-20, replacing the */
/*  shades by position): something new on it is the small orange dot before   */
/*  its mark, never a stroke. Black text, a black subtitle: no grey text      */
/*  inside a choice. The "else" card's lead label is orange in regular weight */
/*  ("Something else · Name a new error"). A selected card has a black edge.  */
/*                                                                            */
/*  Each card is one button (keyboard reachable, Enter and Space pick it); a  */
/*  card with nothing to do (`done`) is not a button at all. No word of its   */
/*  own: every label is the caller's. A card's `menu` (a ⋯, founder           */
/*  2026-10-18) sits on the card's left edge (founder 2026-10-20), never      */
/*  inside the card's button.                                                 */
/* -------------------------------------------------------------------------- */

export type WalkChoiceMark = "chevron" | "check" | "none";

export type WalkChoice = {
  value: string;
  label: string;
  /** A second line, black like the label. */
  subtitle?: string | null;
  /** The orange first line of the "else" card. */
  lead?: string | null;
  /** The mark on the right; a chevron by default. */
  mark?: WalkChoiceMark;
  /** The small orange dot before the mark: something new waits here. */
  dot?: boolean;
  selected?: boolean;
  /** Nothing to do here: drawn, not pressable. */
  done?: boolean;
  /** Drawn faded (a Take still waiting for its text). */
  dim?: boolean;
  /** A ⋯ drawn on the card's left edge: its own button, not the card's. */
  menu?: ReactNode;
  testId?: string;
};

/** The card's background and edge: white, a black edge once picked. Pure. */
export function choiceClass(choice: Pick<WalkChoice, "selected">): string {
  return choice.selected ? "bg-background border-foreground" : "bg-background border-border";
}

function Mark({ choice }: { choice: WalkChoice }) {
  const mark = choice.mark ?? (choice.done ? "none" : "chevron");
  return (
    <span className="flex flex-none items-center gap-2">
      {choice.dot ? <span aria-hidden="true" data-walk-choice-dot className="h-[9px] w-[9px] rounded-full bg-primary" /> : null}
      {mark === "chevron" ? <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] text-foreground" /> : null}
      {mark === "check" ? <Check aria-hidden="true" className="h-[15px] w-[15px] text-affirm" strokeWidth={2.5} /> : null}
    </span>
  );
}

function Body({ choice }: { choice: WalkChoice }) {
  return (
    <span className="min-w-0">
      {choice.lead ? (
        <small data-walk-choice-lead className="mb-px block text-[13.5px] font-normal text-primary">
          {choice.lead}
        </small>
      ) : null}
      <b className="block text-[16px] font-semibold text-foreground">{choice.label}</b>
      {choice.subtitle ? (
        <small className="mt-px block text-[13.5px] text-foreground">{choice.subtitle}</small>
      ) : null}
    </span>
  );
}

const CARD =
  "flex w-full items-center justify-between gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-[13px] text-left";

export default function WalkChoices({
  choices,
  onPick,
  label,
}: {
  choices: readonly WalkChoice[];
  onPick?: (value: string) => void;
  /** The group's accessible name. */
  label?: string;
}) {
  return (
    <div data-walk-choices role="group" aria-label={label} className="flex flex-col gap-2">
      {choices.map((choice, i) => {
        const look = cn(CARD, choiceClass(choice), choice.dim && "opacity-60", choice.menu ? "pl-[52px]" : null);
        const card = choice.done ? (
          <div key={choice.value} data-walk-choice={choice.value} data-testid={choice.testId} className={look}>
            <Body choice={choice} />
            <Mark choice={choice} />
          </div>
        ) : (
          <button
            key={choice.value}
            type="button"
            data-walk-choice={choice.value}
            data-testid={choice.testId}
            aria-pressed={choice.selected === undefined ? undefined : choice.selected}
            onClick={() => onPick?.(choice.value)}
            className={cn("walk-press", look, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2")}
          >
            <Body choice={choice} />
            <Mark choice={choice} />
          </button>
        );
        if (!choice.menu) return card;
        // The card keeps its mark on the right; the ⋯ sits on its left edge,
        // outside the button.
        return (
          <div key={choice.value} className="relative">
            {card}
            <span className="absolute left-1 top-1/2 z-20 -translate-y-1/2">{choice.menu}</span>
          </div>
        );
      })}
    </div>
  );
}
