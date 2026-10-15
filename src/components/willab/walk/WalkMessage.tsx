import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  WalkMessage — the grey bubble on the left (founder lock 2026-10-12, moment  */
/*  and feedback chat, section 1; prototype v31 `.ov.lens .lb`)                */
/*                                                                            */
/*  18.5px text, line height 1.45, 22px corners, padding 13px 17px, no bold   */
/*  anywhere in it: the step's name ("Good job", "Clearer version") is its    */
/*  first line at regular weight. The row aligns at the bottom with a 7px gap */
/*  to the small avatar, which shows on the phone only (founder 2026-10-12:   */
/*  wide screens show no avatar). The coach's bubbles carry the grey-blue     */
/*  avatar. No sender label: the picture is decoration, hidden from           */
/*  assistive tech.                                                           */
/* -------------------------------------------------------------------------- */

/** The grey profile picture: one grey silhouette for the app, the grey-blue
 *  one for the coach, no photos (founder NX2 B, 2026-10-06; lock 2026-10-12).
 *  aria-hidden; still no sender label. */
export function WalkAvatar({ coach = false }: { coach?: boolean }) {
  // The app's own picture is gone everywhere (founder 2026-10-14).
  if (!coach) return null;
  return (
    <span
      aria-hidden="true"
      data-walk-avatar={coach ? "coach" : "app"}
      className={cn(
        "inline-flex h-[22px] w-[22px] flex-none items-end justify-center overflow-hidden rounded-full",
        coach ? "bg-[#bfc7d6]" : "bg-foreground/15",
      )}
    >
      <svg viewBox="0 0 24 24" className={cn("h-[17px] w-[17px]", coach ? "fill-[#5d6b85]" : "fill-foreground/40")} aria-hidden="true">
        <circle cx="12" cy="9" r="4.2" />
        <path d="M3.5 24c.6-5 4.1-8 8.5-8s7.9 3 8.5 8z" />
      </svg>
    </span>
  );
}

export default function WalkMessage({
  children,
  coach = false,
  wide = false,
  className,
}: {
  children: ReactNode;
  /** The coach's bubble: their avatar tone. */
  coach?: boolean;
  /** The bubble takes the whole row (another speaker's clip, a video). */
  wide?: boolean;
  /** A move of the row's own (the AI bubble landing after the typing dots). */
  className?: string;
}) {
  return (
    <div
      data-walk-message
      data-row="app"
      data-walk-coach={coach ? "true" : undefined}
      className={cn("flex items-end gap-[7px] text-[18.5px] leading-[1.45] text-foreground", wide ? "max-w-full" : "max-w-[94%]", className)}
    >
      {/* Only the coach has an avatar (founder 2026-10-14). */}
      {coach ? (
        <span className="md:hidden">
          <WalkAvatar coach />
        </span>
      ) : null}
      <div data-bubble="" className={cn("flex min-w-0 flex-col rounded-[22px] bg-muted px-[17px] py-[13px] font-normal", wide && "flex-1")}>
        {children}
      </div>
    </div>
  );
}

/** The new words inside a message (the clearer version): 600, and the
 *  changed words in orange — the only orange in the bubble. Mark the changed
 *  words with <em>. */
export function WalkNewWords({ children }: { children: ReactNode }) {
  return (
    <span data-walk-new-words className="block font-semibold [&_em]:not-italic [&_em]:text-primary">
      {children}
    </span>
  );
}
