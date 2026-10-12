"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { canBubble, scrollEdge } from "@/lib/willab/deckScroll";
import {
  GLIDE_OUT_MS,
  keyIntent,
  keyIsForTheScreen,
  LAND_EASE,
  LAND_MS,
  type Dir,
} from "@/lib/willab/recordingGesture";

/* -------------------------------------------------------------------------- */
/*  useRecordingGestures — the recording screen's keys and sideways glide      */
/*  (founder lock 2026-10-12, N70 and N70.1).                                  */
/*                                                                            */
/*  ONLY THE CONTENT MOVES. The caller names what moves (the slide and its    */
/*  helper words); this hook writes transforms on exactly those elements and  */
/*  never touches the top bar, the strip or the buttons.                      */
/*                                                                            */
/*  KEYS ON THE DOCUMENT, so they work with no click first; they step aside   */
/*  while a modal dialog (Discard this take?) is open, while the speaker      */
/*  types in a field, and for the Space or Enter that presses a focused       */
/*  button. Keys never end a Take: at the last slide they only nudge.         */
/*                                                                            */
/*  NEVER A PAGE PULL. A touch move the helper words cannot take is cancelled */
/*  (the belt under useNoPullToRefresh), so a pull at the top never reloads   */
/*  the Take. No swipe or scroll changes the slide.                           */
/* -------------------------------------------------------------------------- */

export interface GestureTarget {
  /** The screen's own root, for the modal check. */
  root: () => HTMLElement | null;
  /** What moves: the slide and its helper words. */
  moving: () => HTMLElement[];
  /** The helper words' scroller, which ↓ ↑ scroll first. */
  scroller: () => HTMLElement | null;
  /** How far a glide travels, in px. */
  travel: () => number;
  /** Is there a slide that way? */
  canGo: (dir: Dir) => boolean;
  /** A committed move. The caller usually answers with `glide`. */
  go: (dir: Dir) => void;
}

/** Reduce motion, or a host with no matchMedia (jsdom): no animation. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function paint(
  els: HTMLElement[],
  transform: string,
  opacity: string,
  transition: string,
): void {
  for (const el of els) {
    el.style.transition = transition;
    el.style.transform = transform;
    el.style.opacity = opacity;
  }
}

const SPRING =
  "transform .34s cubic-bezier(.2,.9,.25,1.15), opacity .3s ease";

export function useRecordingGestures(target: GestureTarget): {
  glide: (dir: Dir, swap: () => void) => void;
  enter: (fromPx: number) => void;
} {
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  /** In from `fromPx` (signed, sideways) to rest, on the landing curve. */
  const land = useCallback(
    (els: HTMLElement[], fromPx: number, done: () => void) => {
      paint(els, `translateX(${fromPx}px)`, "0", "none");
      void els[0].offsetHeight;
      paint(
        els,
        "translateX(0px)",
        "1",
        `transform ${LAND_MS}ms ${LAND_EASE}, opacity 300ms ease-out`,
      );
      later(done, LAND_MS);
    },
    [later],
  );

  /** Out in the direction of travel (Next: to the left), swap the content in
   *  place, land from the other side. Instant with reduce motion. */
  const glide = useCallback(
    (dir: Dir, swap: () => void) => {
      if (busyRef.current) return;
      const els = targetRef.current.moving();
      if (prefersReducedMotion() || els.length === 0) {
        swap();
        return;
      }
      busyRef.current = true;
      const d = targetRef.current.travel();
      paint(
        els,
        `translateX(${dir > 0 ? -d : d}px)`,
        "0",
        `transform ${GLIDE_OUT_MS}ms cubic-bezier(.4,0,1,1), opacity ${GLIDE_OUT_MS}ms ease-in`,
      );
      later(() => {
        flushSync(swap);
        const next = targetRef.current.moving().filter((el) => el.isConnected);
        if (next.length === 0) {
          busyRef.current = false;
          return;
        }
        const back = targetRef.current.travel();
        land(next, dir > 0 ? back : -back, () => {
          busyRef.current = false;
        });
      }, GLIDE_OUT_MS);
    },
    [land, later],
  );

  /** The screen's own entrance. */
  const enter = useCallback(
    (fromPx: number) => {
      const els = targetRef.current.moving();
      if (prefersReducedMotion() || els.length === 0) return;
      busyRef.current = true;
      land(els, fromPx, () => {
        busyRef.current = false;
      });
    },
    [land],
  );

  useEffect(() => {
    /** Nowhere to go: a small nudge against the wall, then back. */
    const nudge = (dir: Dir) => {
      if (prefersReducedMotion()) return;
      const els = targetRef.current.moving();
      paint(els, `translateX(${-dir * 12}px)`, "1", "none");
      later(() => paint(els, "translateX(0px)", "1", SPRING), 120);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const t = targetRef.current;
      const intent = keyIntent(event.key);
      if (!intent || !keyIsForTheScreen(event, document, t.root())) return;
      event.preventDefault();
      if (event.repeat || busyRef.current) return;
      const { dir } = intent;
      const scroller = t.scroller();
      if (!intent.slide && scroller && !canBubble(scrollEdge(scroller), dir)) {
        const step =
          dir * scroller.clientHeight * (event.key.startsWith("Page") ? 0.8 : 0.3);
        if (typeof scroller.scrollBy === "function") {
          scroller.scrollBy({
            top: step,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        } else {
          scroller.scrollTop += step;
        }
        return;
      }
      if (t.canGo(dir)) t.go(dir);
      else nudge(dir);
    };

    // The helper words may take a touch scroll they still have room for;
    // every other touch move is cancelled, so it is never a page pull.
    let lastY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      lastY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      const from = lastY;
      lastY = y ?? null;
      const scroller = targetRef.current.scroller();
      const inScroller =
        !!scroller && event.target instanceof Node && scroller.contains(event.target);
      if (inScroller && y !== undefined && from !== null && y !== from) {
        const dir: Dir = from - y > 0 ? 1 : -1;
        if (!canBubble(scrollEdge(scroller), dir)) return;
      }
      if (event.cancelable) event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    const timers = timersRef;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
      busyRef.current = false;
    };
  }, [later]);

  return { glide, enter };
}
