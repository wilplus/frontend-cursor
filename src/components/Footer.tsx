import Link from "next/link";

/**
 * Global footer — pinned to the bottom of the viewport via the parent
 * layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome.
 *
 * "WillpowerLab 2026" on the left, link row on the right. Year is hardcoded
 * by the user's request — no ©/™, no dynamic stamp.
 *
 * Founder 2026-07-27: Science is out of the footer, Journal reads Blog, and
 * Terms & Policy reads Privacy. /science still exists and is still linked from
 * the site menu — only the footer entry is gone.
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
          href="/blog"
          className="no-underline hover:text-foreground transition-colors"
        >
          Blog
        </Link>
        <Link
          href="/terms"
          className="no-underline hover:text-foreground transition-colors"
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}
