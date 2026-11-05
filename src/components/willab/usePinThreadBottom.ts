"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { WILLAB_THREAD_TO_LATEST_EVENT } from "@/lib/willabWindowEvents";

/** How long a pin keeps following the thread as it grows. A new bubble is not
 *  its final height when it mounts: a bot reply reveals line by line and a
 *  card loads its picture, so one scroll lands short of the true bottom. */
export const PIN_FOLLOW_MS = 1500;

/** THE NEWEST BUBBLE IS ALWAYS IN VIEW (founder 2026-09-28: "scroll to the
 *  bottom after the new bubble appears — especially after See next steps").
 *
 *  `pin()` scrolls the thread container (never the page) to its bottom and
 *  keeps it there while the content grows, for PIN_FOLLOW_MS. It runs on
 *  every new message and on the "to latest" window event, which the Ideal
 *  Text fires on See next steps: that bubble arrives while the thread sits
 *  under an overlay, where a scroll computed at arrival is taken against a
 *  thread that is not laid out yet. */
export function usePinThreadBottom(
  scrollRef: RefObject<HTMLDivElement | null>,
  /** The newest message's client_id. Only a change here is a new bubble:
   *  older messages loaded above it leave it as it is. */
  newestId: string | null,
  loading: boolean,
  /** True once the thread has opened at its bottom; until then a growing
   *  count is history arriving, not a new bubble. */
  openedRef: RefObject<boolean>,
): () => void {
  const ready = !loading && openedRef.current === true;
  const stopRef = useRef<(() => void) | null>(null);
  const pin = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stopRef.current?.();
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const frame = requestAnimationFrame(toBottom);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(toBottom);
    const content = el.firstElementChild;
    if (observer) {
      observer.observe(el);
      if (content) observer.observe(content);
      Array.from(el.children).forEach((child) => observer.observe(child));
    }
    const stop = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      clearTimeout(timer);
      if (stopRef.current === stop) stopRef.current = null;
    };
    const timer = setTimeout(stop, PIN_FOLLOW_MS);
    stopRef.current = stop;
  }, [scrollRef]);

  // A new bubble: land on it. The newest message, not the count: a page of
  // older messages put above the thread adds to the count, and reading
  // history stays where it is.
  const seenRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ready) return;
    const before = seenRef.current;
    seenRef.current = newestId;
    if (before !== undefined && newestId !== null && newestId !== before) pin();
  }, [newestId, ready, pin]);

  // Leaving a surface for the chat on purpose: land on the newest bubble,
  // and keep landing on it while the refreshed thread arrives.
  useEffect(() => {
    const onEvent = () => pin();
    window.addEventListener(WILLAB_THREAD_TO_LATEST_EVENT, onEvent);
    return () => {
      window.removeEventListener(WILLAB_THREAD_TO_LATEST_EVENT, onEvent);
      stopRef.current?.();
    };
  }, [pin]);

  return pin;
}

/** OLDER MESSAGES COME IN ABOVE WHAT IS READ ("reading history otherwise
 *  stays where it is"). `before()` notes where the first bubble sits, just
 *  before a page of older messages is put above it; once they are drawn the
 *  thread moves by what was put above, so that bubble stays where the reader
 *  saw it. Safari has no scroll anchoring; where the browser anchored on its
 *  own the bubble has not moved, and this moves nothing. */
export function useKeepPlaceAbove(
  scrollRef: RefObject<HTMLDivElement | null>,
  /** The oldest message's client_id: it changes when a page is put above. */
  oldestId: string | null,
): () => void {
  const markRef = useRef<{ node: Element; top: number } | null>(null);
  const before = useCallback(() => {
    const el = scrollRef.current;
    const node = el?.querySelector(":scope > :not([data-load-older])") ?? null;
    markRef.current = el && node ? { node, top: topIn(el, node) } : null;
  }, [scrollRef]);
  useLayoutEffect(() => {
    const mark = markRef.current;
    markRef.current = null;
    const el = scrollRef.current;
    if (!mark || !el || !mark.node.isConnected) return;
    el.scrollTop += topIn(el, mark.node) - mark.top;
  }, [oldestId, scrollRef]);
  return before;
}

/** Where `node` sits in the thread's visible box, in pixels from its top. */
function topIn(el: Element, node: Element): number {
  return node.getBoundingClientRect().top - el.getBoundingClientRect().top;
}

/** The speaker answered (founder 2026-11-01, N319 item 9): the Lounge lands
 *  on the newest bubble even when it was scrolled up, as on "See next
 *  steps". For answers given outside the Lounge's own handlers (the plan's
 *  footer). */
export function followNewest(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WILLAB_THREAD_TO_LATEST_EVENT));
}
