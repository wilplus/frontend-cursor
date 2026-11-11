"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import OverlayCloseButton from "../OverlayCloseButton";
import { BackRow, useOneBarControls } from "../OneTopBar";
import { useWalkSwipe } from "./useWalkSwipe";
import { LandingNestContext, WalkLanding, useWalkHeld, useWalkPart } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  WalkOverlay — one screen of the Feedback walk (founder lock 2026-10-06)    */
/*                                                                            */
/*  Full screen, nothing of the page behind it, no backdrop. The top bar       */
/*  carries the slide bar (‹ Slide 2 ›) where the screen has one, and ✕. The  */
/*  top bar is the one part that stays still while the content moves: the     */
/*  motion CSS animates every child of `.walk-ov` except `.walk-ovtop`, so    */
/*  the title, the body and the footer must stay direct children.             */
/*                                                                            */
/*  Inside the Feedback walk's thread (WalkThread, founder 2026-10-20) it is  */
/*  one part of the chat instead: its bubbles only, landing one after the     */
/*  other; the newest part's footer goes to the dock under the thread and     */
/*  its ✕ to the thread's bar. The bar's words come from the thread.          */
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
  /** › is off on the last screen (founder 2026-10-15: ‹ › browse every
   *  screen of the walk, answered or not). */
  nextDisabled?: boolean;
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
        disabled={nav.nextDisabled}
        aria-label={COPY.pagerNext}
        className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:cursor-default disabled:opacity-25"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </nav>
  );
}

/** ‹ alone, for a screen with somewhere to go back to but no moments to walk
 *  (the coach panel's speaker screen), with where it goes when the screen
 *  says so ("‹ Library", "‹ Speaking errors"): the one bar's ‹ (N639). */
const BackOnly = BackRow;

export default function WalkOverlay({
  nav,
  caption = null,
  where = null,
  onBack,
  backLabel,
  onClose,
  title,
  subtitle = null,
  footer,
  bare = false,
  landing = true,
  onLanded,
  onSettled,
  testId,
  children,
}: {
  nav?: WalkNav | null;
  /** Where the screen sits ("Slide 2") when there is nowhere to walk: the
   *  bar's text alone, without ‹ ›. Ignored when `nav` or `onBack` is given
   *  (a paragraph opened outside the walk, build plan D-IT-6). */
  caption?: string | null;
  /** The practise recorder's bar ("Practise · Slide 3"): 13px, 600, muted,
   *  as the recording screen's own (lock 2026-10-12, section 2.5). */
  where?: string | null;
  /** ‹ without the moment bar; ignored when `nav` is given. */
  onBack?: () => void;
  /** The words beside that ‹: where it goes. */
  backLabel?: string | null;
  onClose?: () => void;
  title?: string | null;
  /** The grey line under the title (the coach panel's "Goal: …", "Treats:
   *  …"); still, like the title, while the body moves. A node for several
   *  lines of the same small text (the speaker's goal, who the talk is for,
   *  what they should do; founder 2026-10-20, N87). */
  subtitle?: ReactNode;
  /** Normally a WalkFooter. */
  footer?: ReactNode;
  /** Children go straight under the top bar instead of the scrolling body
   *  (the screens that stand apart lay themselves out). */
  bare?: boolean;
  /** In the walk's thread: the bubbles land one after another (the typing
   *  dots). Off where they must show at once (a practise records as it
   *  opens). */
  landing?: boolean;
  /** Once everything in it has landed, the part's opening lines first, as
   *  the step the walk stands on (at once outside the thread): a screen
   *  that only shows its bubbles moves on from here, so they land before it
   *  does (backend N440). */
  onLanded?: () => void;
  /** Each time its bubbles have all landed (true), or start landing again
   *  (false: one drawn in later), as the step the walk stands on: a screen
   *  that moves on after a later bubble waits for it to land (N440). */
  onSettled?: (landed: boolean) => void;
  testId?: string;
  children?: ReactNode;
}) {
  const part = useWalkPart();
  // Opened from Will's lines (N639): the back arrow is the only control.
  const bar = useOneBarControls({ nav, onBack, onClose, backLabel, caption });
  const ov = useRef<HTMLDivElement | null>(null);
  useWalkSwipe(ov, part ? null : nav);
  // Drawn first as the newest part, the step the walk stands on: its
  // bubbles land one after the other, and its footer waits until they
  // have. A part already given (a walk opened on an earlier step) shows at
  // once.
  const [lands] = useState(() => part?.now === true && part.fresh && landing);
  // Unknown until its landing has said (null): nothing moves on, and no
  // button shows, on a guess (N440).
  const [settled, setSettled] = useState<boolean | null>(null);
  // Bubbles that land inside the screen's own (the AI clip's fix), and the
  // part's opening lines above it: the buttons wait for them too (N440).
  const held = useWalkHeld();
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const nest = useCallback((id: string, on: boolean) => {
    setBusy((was) => {
      if (was.has(id) === on) return was;
      const next = new Set(was);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const landed = settled === true && !held && busy.size === 0;
  useEffect(() => {
    if (part?.now) part.close.current = onClose ?? null;
  });
  const told = useRef(false);
  const then = useRef(onLanded);
  then.current = onLanded;
  useEffect(() => {
    if (told.current || !landed || (part && !part.now)) return;
    told.current = true;
    then.current?.();
  }, [landed, part]);
  const settles = useRef(onSettled);
  settles.current = onSettled;
  const standsHere = !part || part.now;
  useEffect(() => {
    if (standsHere) settles.current?.(landed);
  }, [landed, standsHere]);
  if (part) {
    return (
      <>
        <div data-walk-part data-testid={part.now ? testId : undefined} className="flex flex-col gap-4 empty:hidden">
          <LandingNestContext.Provider value={nest}>
            <WalkLanding on={lands && part.now} onSettled={setSettled}>
              {children}
            </WalkLanding>
          </LandingNestContext.Provider>
        </div>
        {part.now && part.dock && footer && landed ? createPortal(footer, part.dock) : null}
      </>
    );
  }
  return (
    <div
      ref={ov}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? (nav ? walkNavText(nav) : undefined)}
      data-testid={testId}
      className="walk-ov flex h-full w-full flex-col bg-background pt-[env(safe-area-inset-top)] text-[17px] leading-[1.55] text-foreground"
    >
      <div className="walk-ovtop flex min-h-[44px] items-center justify-between px-2.5 pt-2">
        {nav ? (
          <NavBar nav={bar.nav ?? nav} />
        ) : bar.back ? (
          <BackOnly onBack={bar.back} label={bar.label} />
        ) : caption ? (
          <span data-walk-caption className="min-w-0 truncate px-2 text-[13.5px] font-semibold">
            {caption}
          </span>
        ) : where ? (
          <p data-walk-where className="m-0 min-w-0 truncate px-1.5 text-[13px] font-semibold tabular-nums text-muted-foreground">
            {where}
          </p>
        ) : (
          <span />
        )}
        {bar.close ? (
          // The app's one small grey X, unchanged (founder 2026-10-07,
          // Q-B14 A (1); D-RC-6): only its place and the walk's press are
          // the overlay's.
          <OverlayCloseButton onClick={bar.close} className="walk-press-sm mr-2.5" />
        ) : (
          <span />
        )}
      </div>
      {title ? (
        <h2 className="px-5 pb-1 pt-3 text-[22px] font-bold leading-[1.2] tracking-[-0.01em]">{title}</h2>
      ) : null}
      {subtitle ? <p data-walk-subtitle className="m-0 px-5 text-[13.5px] text-muted-foreground">{subtitle}</p> : null}
      {bare ? (
        children
      ) : (
        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-3.5")}>{children}</div>
      )}
      {footer}
    </div>
  );
}
