import Link from "next/link";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { uiText, type UiLocale } from "@/lib/uiLocale";

/**
 * Global footer — pinned to the bottom of the viewport via the parent
 * layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome.
 *
 * "WillpowerLab 2026" on the left, link row on the right. Year is hardcoded
 * by the user's request — no ©/™, no dynamic stamp.
 *
 * Founder 2026-07-27: Science is out of the footer, Journal reads Blog, and
 * Terms & Policy reads Privacy. (2026-07-30: /science was then consolidated
 * into the blog entirely — the page is deleted and redirects to /blog, where
 * the papers live as "Science"-category posts.)
 *
 * prefetch={false} (loading audit, 2026-11-02): the footer is on every page,
 * so viewport prefetch fetched /about, /blog and /terms on every open,
 * competing with /chat's boot reads on a phone. A click still navigates.
 *
 * In the iPhone app (founder 2026-11-05): 10px further in from each side
 * than the 16px elsewhere, and nothing under the row, since the phone's
 * home-bar strip below already gives it more than 8px from the edge.
 */
export default function Footer({ initialLocale = "en" }: { initialLocale?: UiLocale }) {
  return (
    <footer className="flex flex-row justify-between items-center shrink-0 px-4 py-2 border-t border-border text-[11px] sm:text-xs text-muted-foreground gap-3 app:px-[26px] app:pb-0 app:pt-1 sm:px-6 sm:py-3">
      <span>{uiText(initialLocale, "footerBrand")}</span>
      <div className="flex gap-3 items-center sm:gap-4">
        <LocaleSwitcher initialLocale={initialLocale} />
        <Link
          href="/about"
          prefetch={false}
          className="no-underline hover:text-foreground transition-colors"
        >
          {uiText(initialLocale, "footerAbout")}
        </Link>
        <Link
          href="/blog"
          prefetch={false}
          className="no-underline hover:text-foreground transition-colors"
        >
          {uiText(initialLocale, "footerBlog")}
        </Link>
        <Link
          href="/terms"
          prefetch={false}
          className="no-underline hover:text-foreground transition-colors"
        >
          {uiText(initialLocale, "footerPrivacy")}
        </Link>
      </div>
    </footer>
  );
}
