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
 *  aria-hidden; still no sender label. */
export function WalkAvatar() {
  return (
    <span
      aria-hidden="true"
      data-walk-avatar
      className="mt-px inline-flex h-6 w-6 flex-none items-end justify-center overflow-hidden rounded-full bg-foreground/15"
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] fill-foreground/40" aria-hidden="true">
        <circle cx="12" cy="9" r="4.2" />
        <path d="M3.5 24c.6-5 4.1-8 8.5-8s7.9 3 8.5 8z" />
      </svg>
    </span>
  );
}

export default function WalkMessage({ children }: { children: ReactNode }) {
  return (
    <div data-walk-message className="flex items-start gap-2.5 text-[17px] leading-[1.55] text-foreground">
      <WalkAvatar />
      <div className="flex min-w-0 flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** The new words inside a message (the clearer version): larger, and the
 *  changed words in orange — the only orange on the screen. Mark the changed
 *  words with <em>. */
export function WalkNewWords({ children }: { children: ReactNode }) {
  return (
    <span data-walk-new-words className="text-[18px] font-semibold leading-[1.45] [&_em]:not-italic [&_em]:text-primary">
      {children}
    </span>
  );
}
