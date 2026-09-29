"use client";

import { useCallback, useRef, useState } from "react";
import type { CoachMessage } from "@/services/api/idealText";

/** Step 0 of the Feedback sheet (founder 2026-09-29, Q1; Final Screens L8).
 *
 *  - NEVER opens by itself (founder 2026-09-29, answering the audit: "never
 *    opens by itself"). The speaker lands on the text and taps Review
 *    feedback; the step is the first screen of that walk.
 *  - Opens FIRST whenever the speaker starts the walk, so it can always be
 *    read again.
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
  const { message, next } = args;
  const [open, setOpen] = useState(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  const has = message !== null;

  const show = useCallback(() => {
    if (!has) return false;
    setOpen(true);
    return true;
  }, [has]);
  const close = useCallback(() => setOpen(false), []);
  const proceed = useCallback(() => {
    close();
    nextRef.current();
  }, [close]);
  return { open, show, proceed, close };
}
