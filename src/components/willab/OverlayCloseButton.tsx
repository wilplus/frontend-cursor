import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  OverlayCloseButton — the ONE top-right close control for every willab       */
/*  overlay (FE-6).                                                            */
/*                                                                            */
/*  Before this there were four hand-rolled variants (bare X, bordered circle,  */
/*  hover-fill ghost, floating dark) at ~13 sites, at 28/30/36px with 16/17/20  */
/*  icons and inconsistent aria-labels. This is the single canonical style:     */
/*  a 28px bordered circle with a 16px X. Position is the caller's job via       */
/*  `className` (e.g. `ml-3` in a header row, or `absolute right-4 top-4`).     */
/* -------------------------------------------------------------------------- */

export default function OverlayCloseButton({
  onClick,
  ariaLabel = "Close",
  className,
}: {
  onClick: () => void;
  ariaLabel?: string;
  /** Position / offset overrides only — the visual treatment is fixed. */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
