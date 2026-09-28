"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
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
  messageCount: number,
  ready: boolean,
): () => void {
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

  // A new bubble: land on it.
  const seenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const before = seenRef.current;
    seenRef.current = messageCount;
    if (before !== null && messageCount > before) pin();
  }, [messageCount, ready, pin]);

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
