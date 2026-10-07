"use client";

import { useEffect, useRef, type RefObject } from "react";

/* -------------------------------------------------------------------------- */
/*  Back from Privacy / Terms to the same spot on Data & consent (settings    */
/*  page lock, ST1 A, 2026-10-07; build plan D-CS-5).                         */
/*                                                                            */
/*  Leaving: the page's scroll position and which legal page was opened are   */
/*  kept for this tab (sessionStorage; every read and write survives a        */
/*  blocked store). Back: when the entry behind the legal page is Data &      */
/*  consent, "Back" is the browser's own back, so history does not grow and   */
/*  the back gesture afterwards does not reopen the legal page; otherwise it  */
/*  replaces the legal page with Data & consent. Either way the page is asked */
/*  to restore its place. Arriving any other way (the menu) starts at the top.*/
/* -------------------------------------------------------------------------- */

const SCROLL_KEY = "willab.dataConsent.scroll";
const LEFT_FOR_KEY = "willab.dataConsent.leftFor";
const RESTORE_KEY = "willab.dataConsent.restore";

/** How long the page keeps trying to reach the saved spot while its cards
 *  are still loading (and so still growing). */
const RESTORE_WINDOW_MS = 2000;

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // A blocked store: the page simply opens at its top.
  }
}

/** The element that scrolls `el`: the app's content slot, or the page. */
export function scrollParentOf(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflow = window.getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/** Data & consent, as a legal link is followed: keep the spot and the page. */
export function rememberDataConsentLeave(page: Element | null, legalPath: string): void {
  const scroller = scrollParentOf(page);
  write(SCROLL_KEY, String(Math.round(scroller?.scrollTop ?? 0)));
  write(LEFT_FOR_KEY, legalPath);
  write(RESTORE_KEY, null);
}

/** On a legal page: is the entry behind this one Data & consent? */
export function cameFromDataConsent(pathname: string | null): boolean {
  return pathname !== null && read(LEFT_FOR_KEY) === pathname;
}

/** "Back" was pressed: Data & consent should open where it was left. */
export function markDataConsentReturn(): void {
  write(LEFT_FOR_KEY, null);
  write(RESTORE_KEY, "1");
}

/** Data & consent, as it opens: the spot to return to, or null for the top.
 *  Consumes the marks, so the next arrival (the menu) starts at the top. */
export function takeDataConsentReturn(): number | null {
  const restore = read(RESTORE_KEY) === "1";
  const saved = Number(read(SCROLL_KEY));
  write(RESTORE_KEY, null);
  write(SCROLL_KEY, null);
  write(LEFT_FOR_KEY, null);
  if (!restore || !Number.isFinite(saved) || saved <= 0) return null;
  return saved;
}

/** Data & consent restores its spot after "Back"; the cards may still be
 *  loading, so it keeps reaching for it briefly, and stops if the reader
 *  scrolls first. */
export function useDataConsentReturn(page: RefObject<HTMLElement | null>): void {
  // Taken once per mount and held: an effect that runs twice (React's
  // development re-run) must not find the marks already consumed.
  const taken = useRef<{ target: number | null } | null>(null);
  useEffect(() => {
    if (taken.current === null) taken.current = { target: takeDataConsentReturn() };
    const target = taken.current.target;
    if (target === null) return;
    const scroller = scrollParentOf(page.current);
    if (!scroller) return;
    let frame = 0;
    let done = false;
    const started = performance.now();
    const stop = () => {
      done = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
    const reach = () => {
      if (done) return;
      scroller.scrollTop = target;
      const there = Math.abs(scroller.scrollTop - target) < 2;
      if (there || performance.now() - started > RESTORE_WINDOW_MS) {
        stop();
        if (taken.current) taken.current.target = null;
        return;
      }
      frame = requestAnimationFrame(reach);
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    reach();
    return stop;
  }, [page]);
}
