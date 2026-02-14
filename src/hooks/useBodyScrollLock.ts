"use client";

import { useEffect } from "react";

const BODY_SCROLL_CLASS = "no-scroll";

/**
 * Locks body scroll when `locked` is true (e.g. when a modal is open).
 * Uses the existing .no-scroll class in globals.css so the overlay covers the whole viewport.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (locked) {
      document.body.classList.add(BODY_SCROLL_CLASS);
    } else {
      document.body.classList.remove(BODY_SCROLL_CLASS);
    }
    return () => {
      document.body.classList.remove(BODY_SCROLL_CLASS);
    };
  }, [locked]);
}
