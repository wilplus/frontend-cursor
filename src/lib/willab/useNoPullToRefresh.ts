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
