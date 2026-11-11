"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { useBackDismiss } from "./useBackDismiss";
import { useEdgeSwipe } from "./chats/useEdgeSwipe";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* -------------------------------------------------------------------------- */
/*  The one top bar (backend N639): what opens from one of Will's lines (the  */
/*  moments to answer, the answers to send, a model to check, "AI models",    */
/*  "Your chat") shows the back arrow on the left and its name beside it, as  */
/*  the AI models page does. No circle, no icon, no "Back" word, no close     */
/*  button, no site bar above. Back goes one step; from the first screen to   */
/*  Will's chat. The phone's own back does the same (OneBarBack).             */
/*                                                                            */
/*  `BackRow` is the AI models page's bar as it was (WalkOverlay's ‹ with its  */
/*  words): every screen with that bar draws this one, so they cannot drift.   */
/* -------------------------------------------------------------------------- */

/** Inside a surface opened from Will's lines, for the ring `chat_builder`:
 *  the walk's screens (WalkOverlay) draw the one bar, with no close. */
export const OneBarContext = createContext(false);

export function useOneBar(): boolean {
  return useContext(OneBarContext);
}

/** A walk screen's bar controls: as given, or, opened from Will's lines,
 *  the back arrow as the only control (a screen with only a close goes back
 *  with the arrow instead, its caption beside it), and a moment's ‹ never
 *  greyed out. */
export function useOneBarControls<N extends { backDisabled?: boolean }>({ nav, onBack, onClose, backLabel, caption }: {
  nav?: N | null;
  onBack?: () => void;
  onClose?: () => void;
  backLabel?: string | null;
  caption?: string | null;
}): { nav: N | null | undefined; back?: () => void; close?: () => void; label?: string | null } {
  const oneBar = useOneBar();
  if (!oneBar) return { nav, back: onBack, close: onClose, label: backLabel };
  return {
    nav: nav ? { ...nav, backDisabled: false } : nav,
    back: nav ? onBack : onBack ?? onClose,
    label: backLabel ?? caption,
  };
}

/** ‹ and, beside it, the name of what is open: 36 px to tap, a 20 px arrow,
 *  13.5 px semibold words. */
export function BackRow({ onBack, label }: { onBack: () => void; label?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-0.5 text-[13.5px] font-semibold">
      <button
        type="button"
        onClick={onBack}
        aria-label={COPY.pagerBack}
        className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      {label ? <span data-walk-back-label className="min-w-0 truncate">{label}</span> : null}
    </span>
  );
}

/** The bar alone, for a screen that is not one of the walk's (the setup's
 *  steps, the coach's queue). `title` null: the arrow alone. */
export default function OneTopBar({ onBack, title = null }: { onBack?: () => void; title?: ReactNode }) {
  return (
    <div data-one-top-bar="" className="walk-ovtop shrink-0 pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-[44px] items-center px-2.5 pt-2">
        {onBack ? (
          <BackRow onBack={onBack} label={title} />
        ) : title ? (
          <span data-walk-back-label className="min-w-0 truncate px-2 text-[13.5px] font-semibold">
            {title}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** In the iPhone app, where the system's swipe is off, a swipe from the
 *  left edge is the phone's Back: one step, as the arrow. */
export function EdgeBack() {
  useEdgeSwipe(
    isNativeApp(),
    () => undefined,
    (go) => {
      if (go) window.history.back();
    },
  );
  return null;
}

/** The phone's own back over a surface with the one bar: one step, as the
 *  arrow. `step` goes one step back inside and says true, or says false on
 *  the first screen, where Back closes the surface (`onClose`). Mounted
 *  while the surface is open; the edge swipe with it (EdgeBack). */
export function OneBarBack({ step, onClose }: { step: () => boolean; onClose: () => void }) {
  useBackDismiss(onClose, step);
  return <EdgeBack />;
}

/** For screens that each draw their own bar (the setup's steps): the bar on
 *  screen hands its back to OneBarBack through this. */
export const BarBackContext = createContext<{ current: (() => boolean) | null } | null>(null);

/** The bar on screen says where its arrow goes, for the phone's back. */
export function useBarBack(onBack: (() => void) | undefined): void {
  const slot = useContext(BarBackContext);
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!slot) return;
    const mine = () => {
      const back = latest.current;
      if (!back) return false;
      back();
      return true;
    };
    slot.current = mine;
    return () => {
      if (slot.current === mine) slot.current = null;
    };
  }, [slot]);
}
