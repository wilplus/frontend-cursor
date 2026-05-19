"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  RatePills — 1..10 horizontal pill row                                      */
/*                                                                            */
/*  The self-rating answer mode (post-snippet "On a scale of 1 to 10…").  */
/*  Ten 44×44 pills in a horizontally scrolling row, single tap picks. The */
/*  picked pill stays filled while the parent's submit is in flight (use   */
/*  the `selected` prop to lock the visual).                                 */
/* -------------------------------------------------------------------------- */

export interface RatePillsProps {
  /** Called with the picked number 1..10. */
  onPick: (value: number) => void;
  /** When non-null, that value renders filled + every other pill disables.
   *  Use to lock the chosen number while the parent POST is in flight. */
  selected?: number | null;
  /** True while the parent's submit is in flight — overlays a spinner on
   *  the selected pill. */
  submitting?: boolean;
}

const VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

export function RatePills({
  onPick,
  selected = null,
  submitting = false,
}: RatePillsProps) {
  const locked = selected !== null;
  return (
    <div
      role="radiogroup"
      aria-label="Rate 1 to 10"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {VALUES.map((n) => {
        const isSelected = selected === n;
        const isDisabled = (locked && !isSelected) || submitting;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Rate ${n}`}
            onClick={() => onPick(n)}
            disabled={isDisabled}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              "text-[15px] font-semibold tabular-nums transition-colors",
              "active:scale-95 disabled:cursor-not-allowed",
              isSelected
                ? "bg-primary text-primary-foreground shadow"
                : "border border-border bg-background text-foreground hover:bg-muted",
              isDisabled && !isSelected && "opacity-50"
            )}
          >
            {isSelected && submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              n
            )}
          </button>
        );
      })}
    </div>
  );
}
