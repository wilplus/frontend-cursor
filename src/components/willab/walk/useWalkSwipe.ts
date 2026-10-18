"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { WalkNav } from "./WalkOverlay";

/* -------------------------------------------------------------------------- */
/*  useWalkSwipe — a finger drags the walk's screens (founder 2026-10-18).     */
/*                                                                            */
/*  On a touch screen the content under the still top bar follows the finger  */
/*  sideways: let go after a drag to the left and it goes on, as ›; to the    */
/*  right and it goes back, as ‹. A short drag, or one toward an arrow that   */
/*  is off, springs back. ✕ alone closes.                                     */
/*                                                                            */
/*  Only inside the Feedback walk and its sheets (not the coach panel), only  */
/*  for touch, and never from a control: a tap stays a tap and a mouse keeps  */
/*  selecting text. The vertical scroll and zoom stay the browser's          */
/*  (touch-action: pan-y pinch-zoom).                                          */
/*                                                                            */
/*  The leaving copy starts where the finger left the content: the drag is    */
/*  handed to globals.css's walk-out-l / walk-out-r as --walk-drag.           */
/* -------------------------------------------------------------------------- */

/** How far a drag goes before letting go moves on. */
const DISTANCE_PX = 64;
/** Or how fast, for a flick (px per ms). */
const FLICK_PX_MS = 0.45;
/** How long the hand-over lasts: the leaving copy's out-move. */
const HANDOVER_MS = 360;
const SPRING = "translate 0.22s cubic-bezier(.2,.8,.2,1)";

const WALK = "[data-feedback-walk], [data-walk-sheet]";
const CONTROL = "button, a, input, textarea, select, label, [role='slider'], [contenteditable='true'], [data-no-swipe]";

const reduced = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
};

/** The parts that move: everything but the top bar. */
const moving = (ov: HTMLElement) =>
  Array.from(ov.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains("walk-ovtop"));

export function useWalkSwipe(ref: RefObject<HTMLElement | null>, nav: WalkNav | null | undefined): void {
  const live = useRef(nav);
  live.current = nav;

  useEffect(() => {
    const ov = ref.current;
    if (!ov || !ov.closest(WALK)) return;
    // On the overlay and on its parts: the scrolling body is where the
    // browser decides who gets the drag.
    for (const el of [ov, ...moving(ov)]) el.style.touchAction = "pan-y pinch-zoom";

    let drag: { id: number; x: number; y: number; t: number; dx: number; on: boolean } | null = null;

    // `translate`, not `transform`: the arrive moves hold their transform
    // (fill: both), and the two compose.
    const place = (dx: number, spring: boolean) => {
      for (const el of moving(ov)) {
        el.style.transition = spring ? SPRING : "";
        el.style.translate = dx ? `${dx}px 0` : "";
      }
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || !live.current) return;
      if ((e.target as Element | null)?.closest?.(CONTROL)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, on: false };
    };

    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          drag = null;
          return;
        }
        if (Math.abs(dx) < 10) return;
        drag.on = true;
      }
      const n = live.current;
      // Toward an arrow that is off, the content gives a little and no more.
      const off = !n || (dx < 0 ? n.nextDisabled : n.backDisabled);
      drag.dx = off ? dx / 4 : dx;
      if (!reduced()) place(drag.dx, false);
    };

    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dx, t, on } = drag;
      drag = null;
      if (!on) return;
      const n = live.current;
      const fast = Math.abs(dx) / Math.max(1, e.timeStamp - t) > FLICK_PX_MS;
      const go = e.type === "pointerup" && (Math.abs(dx) > DISTANCE_PX || fast);
      const to = !n ? null : dx < 0 ? (n.nextDisabled ? null : n.onNext) : n.backDisabled ? null : n.onBack;
      if (!go || !to) {
        place(0, true);
        return;
      }
      const root = document.documentElement;
      root.style.setProperty("--walk-drag", `${dx}px`);
      window.setTimeout(() => root.style.removeProperty("--walk-drag"), HANDOVER_MS);
      place(0, false);
      to();
    };

    ov.addEventListener("pointerdown", down);
    ov.addEventListener("pointermove", move);
    ov.addEventListener("pointerup", up);
    ov.addEventListener("pointercancel", up);
    return () => {
      ov.removeEventListener("pointerdown", down);
      ov.removeEventListener("pointermove", move);
      ov.removeEventListener("pointerup", up);
      ov.removeEventListener("pointercancel", up);
    };
  }, [ref]);
}
