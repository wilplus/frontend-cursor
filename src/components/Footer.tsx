import Link from "next/link";

/**
 * Global footer — pinned to the bottom of the viewport via the parent
 * layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome.
 *
 * Stacks vertically on mobile (< sm) and horizontally on desktop. Links
 * are intentionally underline-free; hover lifts the colour to foreground.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="flex flex-col sm:flex-row justify-between items-center shrink-0 px-6 py-3 border-t border-border text-xs text-muted-foreground gap-4 sm:gap-0">
      <span>© {year} Willab</span>
      <div className="flex gap-4 items-center">
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
