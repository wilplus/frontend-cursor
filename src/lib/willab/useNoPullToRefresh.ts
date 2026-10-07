"use client";

import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/*  useNoPullToRefresh — no browser reload while a Take is only in memory.     */
/*                                                                            */
/*  Founder 2026-10-06: pulling down on the recording screen "activates the   */
/*  loading of the screen". That is the mobile browser's pull-to-refresh      */
/*  (Chrome Android, iOS Safari 15+): a touch that starts outside every inner */
/*  scroller — the slide, the "Take N · Slide x of y" line, the header, the   */
/*  bottom strip — chains to the root, and the root's overscroll reloads the  */
/*  page. A reload mid-recording loses the Take (LIVE LOOP).                  */
/*                                                                            */
/*  While `active`, the root and body get `overscroll-behavior: none`, which  */
/*  turns pull-to-refresh off without touching layout. The previous inline    */
/*  values come back when the last active user lets go, so two screens that   */
/*  both ask (the recording screen, then the upload hand-off) never restore   */
/*  each other's value too early. iOS < 16 ignores the root property; the    */
/*  recording stage's own touchmove belt covers it (RecordingRoadmap).        */
/* -------------------------------------------------------------------------- */

let holders = 0;
let saved: { html: string; body: string } | null = null;

/** Exported for tests; the hook is the only production caller. */
export function holdNoPullToRefresh(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const html = document.documentElement;
  const body = document.body;
  if (holders === 0) {
    saved = {
      html: html.style.overscrollBehavior,
      body: body?.style.overscrollBehavior ?? "",
    };
    html.style.overscrollBehavior = "none";
    if (body) body.style.overscrollBehavior = "none";
  }
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders > 0 || !saved) return;
    html.style.overscrollBehavior = saved.html;
    if (body) body.style.overscrollBehavior = saved.body;
    saved = null;
  };
}

export function useNoPullToRefresh(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return holdNoPullToRefresh();
  }, [active]);
}

/* -------------------------------------------------------------------------- */
/*  The belt, for a screen with no gesture hook of its own (build plan        */
/*  D-RC-3: "Getting your mic ready" before a later Take). iOS < 16 ignores    */
/*  the root's overscroll-behavior, so a touch move that no inner scroller    */
/*  can take is cancelled at the document. A scroller that can still move    */
/*  the way the finger asks keeps its scroll (the training question scrolls). */
/* -------------------------------------------------------------------------- */

function scrollsY(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const overflow = window.getComputedStyle(el).overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/** Can some scroller between `target` and the page take a scroll in `dir`
 *  (1 = towards the end, the finger moving up; -1 = towards the top)?
 *  Exported for tests. */
export function innerScrollerTakes(target: EventTarget | null, dir: 1 | -1): boolean {
  let el: Element | null = target instanceof Element ? target : null;
  while (el && el !== document.documentElement && el !== document.body) {
    if (scrollsY(el)) {
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (dir === -1 ? !atTop : !atBottom) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** Exported for tests; the hook is the only production caller. */
export function holdTouchPullBelt(): () => void {
  if (typeof document === "undefined") return () => undefined;
  let lastY: number | null = null;
  const onStart = (event: TouchEvent) => {
    lastY = event.touches[0]?.clientY ?? null;
  };
  const onMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY;
    if (y === undefined) return;
    const dy = lastY === null ? 0 : y - lastY;
    lastY = y;
    if (dy === 0) return;
    // The finger moving down asks the content to scroll towards its top.
    if (innerScrollerTakes(event.target, dy > 0 ? -1 : 1)) return;
    if (event.cancelable) event.preventDefault();
  };
  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: false });
  return () => {
    document.removeEventListener("touchstart", onStart);
    document.removeEventListener("touchmove", onMove);
  };
}

/** The belt while `active`: see holdTouchPullBelt. */
export function useTouchPullBelt(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return holdTouchPullBelt();
  }, [active]);
}
