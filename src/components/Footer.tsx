import Link from "next/link";

/**
 * Global footer — pinned to the bottom of the viewport via the parent
 * layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome.
 *
 * Right-aligned link row only. The © stamp was removed at the user's
 * request; switched the parent flex from `justify-between` to
 * `justify-end` so the links keep their right-edge anchor.
 */
export default function Footer() {
  return (
    <footer className="flex flex-row justify-end items-center shrink-0 px-4 py-2 border-t border-border text-[11px] sm:text-xs text-muted-foreground gap-3 sm:px-6 sm:py-3">
      <div className="flex gap-3 items-center sm:gap-4">
        <Link
          href="/science"
          className="no-underline hover:text-foreground transition-colors"
        >
          Science
        </Link>
        <Link
          href="/privacy"
          className="no-underline hover:text-foreground transition-colors"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="no-underline hover:text-foreground transition-colors"
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
