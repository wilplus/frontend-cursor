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
/*                                                                            */
/*  KEPT AS THE ONE X EVERYWHERE (founder 2026-10-07, Q-B14 A (1); build plan  */
/*  D-RC-6): the recording screens, the text page's header and the Feedback    */
/*  walk all draw this button unchanged, and the walk's 30px filled circle     */
/*  from its prototype is not built. overlayCloseButton.test.tsx pins it.      */
/* -------------------------------------------------------------------------- */

/** The one style: a 28px bordered circle, grey, filling on hover. Shared
 *  with the text page's ⋯ beside it (founder 2026-10-07, Q-B14 A (1): "keep
 *  the app's one small grey X everywhere"; build plan D-RC-6), so the two
 *  can never drift apart. Position is still the caller's.
 *
 *  BIGGER TO TAP, THE SAME TO SEE: an invisible area (`after:`) makes it
 *  44px tall, as the walk's ✕ already is (backend N440). Sideways it grows
 *  3px only, half the 6px between the ⋯ and the ✕, so neither ever takes
 *  the other's tap; the ✕ makes up the rest on its outer side (below). */
export const OVERLAY_ICON_BUTTON_CLASS =
  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground after:absolute after:-inset-y-2 after:-left-[3px] after:-right-[3px] after:content-['']";

/** The ✕'s tap area, 44px wide: the 3px toward its neighbour (the ⋯, a
 *  title) and the rest outward, to its right, where a close sits. */
const CLOSE_TAP_AREA_CLASS = "after:-right-[13px]";

/** The icon inside it: 16px. */
export const OVERLAY_ICON_CLASS = "h-4 w-4";

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
      className={cn(OVERLAY_ICON_BUTTON_CLASS, CLOSE_TAP_AREA_CLASS, className)}
    >
      <X className={OVERLAY_ICON_CLASS} aria-hidden />
    </button>
  );
}
