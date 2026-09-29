"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoachMessage } from "@/services/api/idealText";

/** Which published message this browser has already opened. Per message, so
 *  the next publish opens by itself again. A convenience only: failing storage
 *  just means the step opens once more. */
export function coachSeenKey(arcId: string | null, message: CoachMessage): string {
  return `willab.coachMessageSeen.${arcId ?? "none"}.${
    message.publishedAt ?? message.takeIndex ?? "latest"
  }`;
}

function wasSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* private window or blocked storage: the step simply opens again */
  }
}

/** Step 0 of the Feedback sheet (founder 2026-09-29, Q1; Final Screens L8).
 *
 *  - Opens BY ITSELF once, the first time the Ideal Text is ready after a
 *    publish carrying a message.
 *  - Opens FIRST whenever the speaker starts the walk (Review feedback), so
 *    it can always be read again.
 *  - Continue calls `next` (the host's "go to the first waiting moment"),
 *    which does nothing when nothing waits.
 *
 *  Its own hook so the deck gains a line, not a branch. */
export function useCoachStep(args: {
  arcId: string | null;
  message: CoachMessage | null;
  ready: boolean;
  next: () => void;
}): {
  open: boolean;
  /** Show step 0 if there is a message; false when there is none. */
  show: () => boolean;
  proceed: () => void;
  close: () => void;
} {
  const { arcId, message, ready, next } = args;
  const [open, setOpen] = useState(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  const key = message ? coachSeenKey(arcId, message) : null;

  useEffect(() => {
    if (!ready || !key || wasSeen(key)) return;
    setOpen(true);
  }, [ready, key]);

  const show = useCallback(() => {
    if (!key) return false;
    setOpen(true);
    return true;
  }, [key]);
  const close = useCallback(() => {
    if (key) markSeen(key);
    setOpen(false);
  }, [key]);
  const proceed = useCallback(() => {
    close();
    nextRef.current();
  }, [close]);
  return { open, show, proceed, close };
}
