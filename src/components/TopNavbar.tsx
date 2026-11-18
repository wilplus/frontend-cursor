import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** The Speaking Coach navbar's separator is the visual contract for app chrome. */
export const TOP_NAV_SEPARATOR_CLASS = "border-b border-border";

/** The established safe width for navbar controls on the web. */
export const TOP_NAV_CONTENT_CLASS = "mx-auto w-full max-w-4xl px-[15px]";

/** The shared left-facing navigation control used by full-screen surfaces. */
export function TopNavbarBackButton({
  onClick,
  ariaLabel = "Back",
  disabled = false,
  className,
}: {
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-top-navbar-back
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-50",
        className,
      )}
    >
      <ChevronLeft className="h-6 w-6" aria-hidden />
    </button>
  );
}

/**
 * Full-bleed navbar shell with a constrained control row.
 *
 * The outer element owns the separator so it cannot inherit a page's content
 * width. Callers own the row height and safe-area treatment because overlays
 * and the app navbar have different vertical contracts.
 */
export default function TopNavbar({
  children,
  className,
  contentClassName,
  dataChatHeader = false,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Keep the chat bar's legacy query surface on the control row itself. */
  dataChatHeader?: boolean;
}) {
  return (
    <div data-top-navbar className={cn("shrink-0", TOP_NAV_SEPARATOR_CLASS, className)}>
      <div
        data-top-navbar-content
        {...(dataChatHeader ? { "data-chat-header": true } : {})}
        className={cn(TOP_NAV_CONTENT_CLASS, contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
