"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  CharismaStress — binary charisma vs stress label slot                     */
/*                                                                            */
/*  The "was this a charisma moment or a stress moment?" answer mode used   */
/*  on snippet-review cards. Two equal pills, emerald = charisma, red =     */
/*  stress. After tap the picked pill stays filled while the parent's      */
/*  POST is in flight (use `selected` + `submitting`).                      */
/*                                                                            */
/*  Colours intentionally use the `success` / `danger` tokens (semantic    */
/*  charisma/stress valence) rather than the generic `destructive` token   */
/*  (which is for delete confirms + error toasts).                          */
/* -------------------------------------------------------------------------- */

export type CharismaStressValue = "charisma" | "stress";

export interface CharismaStressProps {
  onPick: (value: CharismaStressValue) => void;
  /** Locks visual once the user has chosen — null = nothing picked yet. */
  selected?: CharismaStressValue | null;
  /** Spinner on the chosen pill while the parent's submit is in flight. */
  submitting?: boolean;
  /** Optional label overrides. Default: "Charisma" / "Stress". */
  charismaLabel?: string;
  stressLabel?: string;
}

export function CharismaStress({
  onPick,
  selected = null,
  submitting = false,
  charismaLabel = "Charisma",
  stressLabel = "Stress",
}: CharismaStressProps) {
  const locked = selected !== null;
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {(
        [
          { value: "charisma" as const, label: charismaLabel, tone: "success" as const },
          { value: "stress" as const, label: stressLabel, tone: "danger" as const },
        ]
      ).map(({ value, label, tone }) => {
        const isSelected = selected === value;
        const isDisabled = (locked && !isSelected) || submitting;
        const filled = tone === "success"
          ? "bg-success text-success-foreground hover:bg-success/90"
          : "bg-danger text-danger-foreground hover:bg-danger/90";
        const outline = tone === "success"
          ? "border border-success/40 text-foreground hover:bg-success/10"
          : "border border-danger/40 text-foreground hover:bg-danger/10";
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={label}
            onClick={() => onPick(value)}
            disabled={isDisabled}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-full",
              "text-[15px] font-semibold transition-colors active:scale-[.98]",
              "disabled:cursor-not-allowed",
              isSelected ? filled : outline,
              isDisabled && !isSelected && "opacity-50"
            )}
          >
            {isSelected && submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
