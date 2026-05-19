"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  YesNoPills — binary tap surface, reused across consent moments            */
/*                                                                            */
/*  The shared Yes/No surface for every binary question the chat asks:      */
/*  mic permission, snippet sharing (in-org), snippet sharing (global),     */
/*  privacy policy, synthetic-data sharing, weekly emails, etc. Same        */
/*  visual everywhere so the user learns the affordance once.                */
/*                                                                            */
/*  After the user picks: the chosen pill stays filled (primary for Yes,    */
/*  outline for No), the unchosen fades to opacity-50, both disable. The   */
/*  parent advances the conversation; this component owns no internal      */
/*  state beyond what's passed in.                                          */
/* -------------------------------------------------------------------------- */

export type YesNoValue = "yes" | "no";

export interface YesNoPillsProps {
  onPick: (value: YesNoValue) => void;
  /** Locked value once the user has chosen. Null = nothing picked yet. */
  selected?: YesNoValue | null;
  /** True while parent's submit is in flight — overlays a spinner on
   *  the chosen pill. */
  submitting?: boolean;
  /** Optional label overrides. Default: "Yes" / "No". */
  yesLabel?: string;
  noLabel?: string;
}

export function YesNoPills({
  onPick,
  selected = null,
  submitting = false,
  yesLabel = "Yes",
  noLabel = "No",
}: YesNoPillsProps) {
  const locked = selected !== null;
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {(
        [
          { value: "yes" as const, label: yesLabel, variant: "primary" as const },
          { value: "no" as const, label: noLabel, variant: "outline" as const },
        ]
      ).map(({ value, label, variant }) => {
        const isSelected = selected === value;
        const isDisabled = (locked && !isSelected) || submitting;
        const filled =
          variant === "primary"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15";
        const rest =
          variant === "primary"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border bg-background text-foreground hover:bg-muted";
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
              isSelected ? filled : rest,
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
