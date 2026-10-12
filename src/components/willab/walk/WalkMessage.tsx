import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  WalkMessage — every message in the walk (founder lock 2026-10-06)          */
/*                                                                            */
/*  Plain black text with a small grey profile picture beside it: one grey     */
/*  profile picture for the coach and the app alike, no photos (founder NX2 B, */
/*  2026-10-06; decisions log N53). NO sender label ("Your coach", "What you   */
/*  said"): the picture is decoration and is hidden from assistive tech, so    */
/*  nothing names a sender.                                                    */
/* -------------------------------------------------------------------------- */

/** The grey profile picture: one grey silhouette for the coach and the app
 *  alike, no photos (founder NX2 B, 2026-10-06; decisions log N53).
 *  aria-hidden; still no sender label. Phones only: on a wide screen the
 *  bubble stands alone (founder 2026-10-12). */
export function WalkAvatar() {
  return (
    <span
      aria-hidden="true"
      data-walk-avatar
      className="mt-px inline-flex h-[22px] w-[22px] flex-none items-end justify-center overflow-hidden rounded-full bg-foreground/15 md:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-foreground/40" aria-hidden="true">
        <circle cx="12" cy="9" r="4.2" />
        <path d="M3.5 24c.6-5 4.1-8 8.5-8s7.9 3 8.5 8z" />
      </svg>
    </span>
  );
}

export default function WalkMessage({ children }: { children: ReactNode }) {
  return (
    <div data-walk-message className="flex items-start gap-2.5 text-[18.5px] leading-[1.5] text-foreground">
      <WalkAvatar />
      {/* The lens's bubble (founder lock 2026-10-12, section 1): light grey,
          22px corners, 18.5px text, no bold. */}
      <div className="flex min-w-0 flex-col gap-2.5 rounded-[22px] bg-muted px-4 py-3 font-normal">{children}</div>
    </div>
  );
}

/** The new words inside a message (the clearer version): larger, and the
 *  changed words in orange — the only orange on the screen. Mark the changed
 *  words with <em>. */
export function WalkNewWords({ children }: { children: ReactNode }) {
  return (
    <span data-walk-new-words className="text-[18.5px] font-normal leading-[1.45] [&_em]:not-italic [&_em]:text-primary">
      {children}
    </span>
  );
}
