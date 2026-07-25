import Link from "next/link";

/**
 * Global footer — pinned to the bottom of the viewport via the parent
 * layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome.
 *
 * "WillpowerLab 2026" on the left, link row on the right. Year is hardcoded
 * by the user's request — no ©/™, no dynamic stamp.
 */
export default function Footer() {
  return (
    <footer className="flex flex-row justify-between items-center shrink-0 px-4 py-2 border-t border-border text-[11px] sm:text-xs text-muted-foreground gap-3 sm:px-6 sm:py-3">
      <span>WillpowerLab 2026</span>
      <div className="flex gap-3 items-center sm:gap-4">
        <Link
          href="/about"
          className="no-underline hover:text-foreground transition-colors"
        >
          About us
        </Link>
        <Link
          href="/science"
          className="no-underline hover:text-foreground transition-colors"
        >
          Science
        </Link>
        <Link
          href="/journal"
          className="no-underline hover:text-foreground transition-colors"
        >
          Journal
        </Link>
        <Link
          href="/terms"
          className="no-underline hover:text-foreground transition-colors"
        >
          Terms &amp; Policy
        </Link>
      </div>
    </footer>
  );
}
