"use client";

import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  WalkChoices — one list of choices (founder lock 2026-10-06, the coach     */
/*  panel redrawn: "One action per screen. Buttons with different jobs never  */
/*  look alike").                                                             */
/*                                                                            */
/*  The cards shade by position, one step per card, so neighbours never       */
/*  blend: the 1st white, the 2nd #f7f7f8, the 3rd #efeff1, the 4th and on    */
/*  #e4e4e7. Black text, a black subtitle: no grey text inside a choice. Two  */
/*  cards keep their own shade wherever they sit: "else" (light grey, its    */
/*  lead label orange in regular weight: "Something else · Name a new error") */
/*  and "noerr" (the darker grey: "I don't hear an error"). A selected card   */
/*  turns white with a black edge.                                            */
/*                                                                            */
/*  Each card is one button (keyboard reachable, Enter and Space pick it); a  */
/*  card with nothing to do (`done`) is not a button at all. No word of its   */
/*  own: every label is the caller's.                                         */
/* -------------------------------------------------------------------------- */

export type WalkChoiceMark = "chevron" | "check" | "none";

export type WalkChoice = {
  value: string;
  label: string;
  /** A second line, black like the label. */
  subtitle?: string | null;
  /** The orange first line of the "else" card. */
  lead?: string | null;
  variant?: "else" | "noerr";
  /** The mark on the right; a chevron by default. */
  mark?: WalkChoiceMark;
  /** The small orange dot before the mark (a speaker waiting). */
  dot?: boolean;
  selected?: boolean;
  /** Nothing to do here: drawn, not pressable. */
  done?: boolean;
  /** Drawn faded (a Take still waiting for its text). */
  dim?: boolean;
  testId?: string;
};

/** The shade of the card at `index` (0-based), by position. Pure. */
export function choiceShade(index: number): "white" | "g1" | "g2" | "g3" {
  if (index <= 0) return "white";
  if (index === 1) return "g1";
  if (index === 2) return "g2";
  return "g3";
}

const SHADE: Record<ReturnType<typeof choiceShade> | "else" | "noerr", string> = {
  white: "bg-background border-border",
  g1: "bg-[#f7f7f8] border-[#f7f7f8] dark:bg-foreground/[0.04] dark:border-transparent",
  g2: "bg-[#efeff1] border-[#efeff1] dark:bg-foreground/[0.08] dark:border-transparent",
  g3: "bg-[#e4e4e7] border-[#e4e4e7] dark:bg-foreground/[0.12] dark:border-transparent",
  else: "bg-muted border-muted",
  noerr: "bg-[#e4e4e7] border-[#e4e4e7] dark:bg-foreground/[0.12] dark:border-transparent",
};

/** The card's background and edge. Pure, so the shading is a unit test. */
export function choiceClass(choice: Pick<WalkChoice, "variant" | "selected">, index: number): string {
  if (choice.selected) return "bg-background border-foreground";
  if (choice.variant) return SHADE[choice.variant];
  return SHADE[choiceShade(index)];
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
        const look = cn(CARD, choiceClass(choice, i), choice.dim && "opacity-60");
        if (choice.done) {
          return (
            <div key={choice.value} data-walk-choice={choice.value} data-testid={choice.testId} className={look}>
              <Body choice={choice} />
              <Mark choice={choice} />
            </div>
          );
        }
        return (
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
      })}
    </div>
  );
}
