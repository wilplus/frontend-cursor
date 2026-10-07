"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { canBubble, scrollEdge } from "@/lib/willab/deckScroll";
import {
  followOpacity,
  GLIDE_OUT_MS,
  IDLE_WHEEL,
  keyIntent,
  keyIsForTheScreen,
  LAND_EASE,
  LAND_MS,
  modalOpenOver,
  rubberBand,
  touchRelease,
  WHEEL_FOLLOW,
  WHEEL_REST_MS,
  wheelDeltaPx,
  wheelRest,
  wheelStep,
  type Dir,
  type WheelState,
} from "@/lib/willab/recordingGesture";

/* -------------------------------------------------------------------------- */
/*  useRecordingGestures — the recording screens' touch, wheel and keys        */
/*  (founder lock 2026-10-07, "How it moves").                                 */
/*                                                                            */
/*  ONLY THE CONTENT MOVES. The caller names what moves (the slide and its    */
/*  helper words, or the learning screen); this hook writes transforms on     */
/*  exactly those elements and never touches the top bar, the slide dots or   */
/*  the strip, which are not re-rendered by a move either.                    */
/*                                                                            */
/*  ON THE DOCUMENT, NOT ON THE CONTENT. The prototype listens on the whole   */
/*  screen: a scroll over the margins of a desktop, or a key pressed before   */
/*  anything was clicked, still moves the slide. The listeners exist only     */
/*  while the screen that owns them is mounted, and step aside while a modal  */
/*  dialog (Discard this take?) is open or the speaker is typing in a field.  */
/*                                                                            */
/*  NEVER A PAGE PULL. A touch move the helper words cannot take is cancelled */
/*  (the belt under useNoPullToRefresh, for browsers that ignore the root's   */
/*  overscroll-behavior), so a pull at the top never reloads the Take.        */
/* -------------------------------------------------------------------------- */

export interface GestureTarget {
  /** The screen's own root, for the modal check. */
  root: () => HTMLElement | null;
  /** What moves: the slide and its helper words, or the learning screen. */
  moving: () => HTMLElement[];
  /** The helper words' scroller, which takes the scroll first. */
  scroller: () => HTMLElement | null;
  /** How far a glide travels, in px. */
  travel: () => number;
  /** Is there somewhere to go that way (a slide, or the start)? */
  canGo: (dir: Dir) => boolean;
  /** A committed move. The caller usually answers with `glide`. */
  go: (dir: Dir) => void;
  /** The learning screen: the forward keys and Enter start; back is idle. */
  startKeys?: boolean;
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

/** The helper words can still scroll in `dir`. */
function innerCanTake(scroller: HTMLElement | null, dir: Dir): boolean {
  return !!scroller && !canBubble(scrollEdge(scroller), dir);
}

/** ONE WHEEL STATE for both screens: the push that starts the recording
 *  leaves its momentum tail on the slide that lands, and that tail must be
 *  swallowed there exactly as it would be after a slide change. */
let sharedWheel: WheelState = IDLE_WHEEL;

/** Exported for tests. */
export function resetSharedWheel(): void {
  sharedWheel = IDLE_WHEEL;
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
  const restRef = useRef<number | null>(null);
  const touchRef = useRef<{
    y: number;
    inScroller: boolean;
    travel: number;
  } | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const follow = useCallback((d: number, free: boolean) => {
    if (prefersReducedMotion()) return;
    const y = -rubberBand(d, free);
    paint(
      targetRef.current.moving(),
      `translateY(${y}px)`,
      String(followOpacity(y)),
      "none",
    );
  }, []);

  const springBack = useCallback(() => {
    paint(
      targetRef.current.moving(),
      "translateY(0px)",
      "1",
      prefersReducedMotion() ? "none" : SPRING,
    );
  }, []);

  /** In from `fromPx` (signed) to rest, on the landing curve. */
  const land = useCallback(
    (els: HTMLElement[], fromPx: number, done: () => void) => {
      paint(els, `translateY(${fromPx}px)`, "0", "none");
      void els[0].offsetHeight;
      paint(
        els,
        "translateY(0px)",
        "1",
        `transform ${LAND_MS}ms ${LAND_EASE}, opacity 300ms ease-out`,
      );
      later(done, LAND_MS);
    },
    [later],
  );

  /** Out in the direction of travel, swap the content in place, land from
   *  the other side. Instant with reduce motion. */
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
        `translateY(${dir > 0 ? -d : d}px)`,
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

  /** The screen's own entrance: lands from `fromPx` below. */
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
    const commit = (dir: Dir) => {
      if (targetRef.current.canGo(dir)) targetRef.current.go(dir);
      else springBack();
    };
    const clearRest = () => {
      if (restRef.current !== null) window.clearTimeout(restRef.current);
      restRef.current = null;
    };
    const armRest = () => {
      clearRest();
      restRef.current = window.setTimeout(() => {
        restRef.current = null;
        const out = wheelRest(sharedWheel);
        sharedWheel = out.state;
        if (out.action.kind === "commit") commit(out.action.dir);
        else springBack();
      }, WHEEL_REST_MS);
    };

    const onTouchStart = (event: TouchEvent) => {
      const t = targetRef.current;
      const y = event.touches[0]?.clientY;
      if (y === undefined || busyRef.current || modalOpenOver(document, t.root())) {
        touchRef.current = null;
        return;
      }
      const scroller = t.scroller();
      touchRef.current = {
        y,
        inScroller:
          !!scroller && event.target instanceof Node && scroller.contains(event.target),
        travel: 0,
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      const t = targetRef.current;
      const touch = touchRef.current;
      const y = event.touches[0]?.clientY;
      if (!touch || y === undefined) {
        const scroller = t.scroller();
        const inScroller =
          !!scroller && event.target instanceof Node && scroller.contains(event.target);
        if (!inScroller && event.cancelable) event.preventDefault();
        return;
      }
      const travel = touch.y - y;
      const dir: Dir = travel > 0 ? 1 : -1;
      // The helper words scroll first; the slide moves from their edge on.
      if (touch.inScroller && innerCanTake(t.scroller(), dir)) {
        touch.y = y;
        touch.travel = 0;
        return;
      }
      if (event.cancelable) event.preventDefault();
      touch.travel = travel;
      follow(travel, t.canGo(dir));
    };
    const onTouchEnd = () => {
      const touch = touchRef.current;
      touchRef.current = null;
      if (!touch) return;
      const dir = touchRelease(touch.travel, targetRef.current.canGo);
      if (dir) targetRef.current.go(dir);
      else if (touch.travel !== 0) springBack();
    };
    const onTouchCancel = () => {
      touchRef.current = null;
      springBack();
    };

    const onWheel = (event: WheelEvent) => {
      const t = targetRef.current;
      if (event.ctrlKey || modalOpenOver(document, t.root())) return;
      event.preventDefault();
      const deltaY = wheelDeltaPx(event, window.innerHeight);
      if (deltaY === 0) return;
      const scroller = t.scroller();
      const out = wheelStep(sharedWheel, {
        deltaY,
        now: performance.now(),
        innerCanTake: innerCanTake(scroller, deltaY > 0 ? 1 : -1),
        busy: busyRef.current,
      });
      sharedWheel = out.state;
      const action = out.action;
      if (action.kind === "scroll-inner" && scroller) {
        scroller.scrollTop += deltaY;
      } else if (action.kind === "follow") {
        follow(action.acc * WHEEL_FOLLOW, t.canGo(action.dir));
        armRest();
      } else if (action.kind === "commit") {
        clearRest();
        commit(action.dir);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const t = targetRef.current;
      const intent = keyIntent(event.key);
      if (!intent || !keyIsForTheScreen(event, document, t.root())) return;
      if (t.startKeys) {
        if (intent === "back") return;
        event.preventDefault();
        if (!event.repeat && !busyRef.current) commit(1);
        return;
      }
      if (intent === "start") return;
      event.preventDefault();
      if (event.repeat || busyRef.current) return;
      const dir: Dir = intent === "forward" ? 1 : -1;
      const scroller = t.scroller();
      if (scroller && innerCanTake(scroller, dir)) {
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
      if (t.canGo(dir)) {
        t.go(dir);
        return;
      }
      // Nowhere to go: a small nudge against the wall, then back.
      follow(dir * 60, false);
      later(springBack, 120);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    const timers = timersRef;
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
      clearRest();
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
      busyRef.current = false;
      touchRef.current = null;
    };
  }, [follow, later, springBack]);

  return { glide, enter };
}
