"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import OverlayCloseButton from "../OverlayCloseButton";

/* -------------------------------------------------------------------------- */
/*  WalkOverlay — one screen of the Feedback walk (founder lock 2026-10-06)    */
/*                                                                            */
/*  Full screen, nothing of the page behind it, no backdrop. The top bar       */
/*  carries the slide and moment bar (‹ Slide 2 · moment 1 of 4 ›) where the  */
/*  screen has one, and ✕. The top bar is the one part that stays still while */
/*  the content moves: the motion CSS animates every child of `.walk-ov`       */
/*  except `.walk-ovtop`, so the title, the body and the footer must stay     */
/*  direct children.                                                          */
/* -------------------------------------------------------------------------- */

export type WalkNav = {
  /** Where the moment sits ("Slide 2"). */
  label?: string | null;
  index: number;
  total: number;
  /** The whole centre text, when it is not "moment N of M" (the coach's
   *  note reads "Take 2"). */
  position?: string;
  onBack: () => void;
  onNext: () => void;
  /** Back is off on the first screen. */
  backDisabled?: boolean;
};

export function walkNavText(nav: WalkNav): string {
  if (nav.position) return nav.position;
  const moment = `${COPY.pagerMoment} ${nav.index + 1} ${COPY.pagerOf} ${nav.total}`;
  return nav.label ? `${nav.label} · ${moment}` : moment;
}

function NavBar({ nav }: { nav: WalkNav }) {
  const text = walkNavText(nav);
  return (
    <nav data-walk-nav aria-label={text} className="flex min-w-0 items-center gap-0.5 text-[13.5px] font-semibold">
      <button
        type="button"
        onClick={nav.onBack}
        disabled={nav.backDisabled}
        aria-label={COPY.pagerBack}
        className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:cursor-default disabled:opacity-25"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <span className="min-w-0 truncate">{text}</span>
      <button
        type="button"
        onClick={nav.onNext}
        aria-label={COPY.pagerNext}
        className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </nav>
  );
}

/** ‹ alone, for a screen with somewhere to go back to but no moments to walk
 *  (the coach panel's speaker screen). */
function BackOnly({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={COPY.pagerBack}
      className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
    >
      <ChevronLeft className="h-5 w-5" aria-hidden />
    </button>
  );
}

export default function WalkOverlay({
  nav,
  onBack,
  onClose,
  title,
  footer,
  bare = false,
  testId,
  children,
}: {
  nav?: WalkNav | null;
  /** ‹ without the moment bar; ignored when `nav` is given. */
  onBack?: () => void;
  onClose?: () => void;
  title?: string | null;
  /** Normally a WalkFooter. */
  footer?: ReactNode;
  /** Children go straight under the top bar instead of the scrolling body
   *  (the screens that stand apart lay themselves out). */
  bare?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? (nav ? walkNavText(nav) : undefined)}
      data-testid={testId}
      className="walk-ov flex h-full w-full flex-col bg-background pt-[env(safe-area-inset-top)] text-[17px] leading-[1.55] text-foreground"
    >
      <div className="walk-ovtop flex min-h-[44px] items-center justify-between px-2.5 pt-2">
        {nav ? <NavBar nav={nav} /> : onBack ? <BackOnly onBack={onBack} /> : <span />}
        {onClose ? (
          <OverlayCloseButton
            onClick={onClose}
            className="walk-press-sm mr-2.5 h-[30px] w-[30px] border-transparent bg-muted"
          />
        ) : (
          <span />
        )}
      </div>
      {title ? (
        <h2 className="px-5 pb-1 pt-3 text-[22px] font-bold leading-[1.2] tracking-[-0.01em]">{title}</h2>
      ) : null}
      {bare ? (
        children
      ) : (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 py-3")}>{children}</div>
      )}
      {footer}
    </div>
  );
}
