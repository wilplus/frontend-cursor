"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoachMessage } from "@/services/api/idealText";
import { coachWordKey, coachWordSeen, markCoachWordSeen } from "./coachWordSeen";

/** Step 0 of the Feedback sheet (founder 2026-09-29, Q1; Final Screens L8).
 *
 *  - NEVER opens by itself (founder 2026-09-29, answering the audit: "never
 *    opens by itself"). The speaker lands on the text and taps Review
 *    feedback; the step is the first screen of that walk.
 *  - Opens FIRST whenever the speaker starts the walk, so it can always be
 *    read again.
 *  - Continue calls `next` (the host's "go to the first waiting moment"),
 *    which does nothing when nothing waits.
 *  - REACHABLE WHILE UNSEEN (founder 2026-10-05, N48.3 Q11 A): `unseen` says
 *    the word for the Take on screen has not been shown yet, so the host
 *    keeps "Review feedback" on the page for it even after every moment is
 *    answered. Showing the step marks the word seen.
 *
 *  Its own hook so the deck gains a line, not a branch. */
export function useCoachStep(args: {
  arcId: string | null;
  message: CoachMessage | null;
  ready: boolean;
  next: () => void;
}): {
  open: boolean;
  /** An unseen word for the Take on screen waits for step 0. */
  unseen: boolean;
  /** Show step 0 if there is a message; false when there is none. */
  show: () => boolean;
  proceed: () => void;
  close: () => void;
  /** The word was shown elsewhere (the Feedback walk's coach's note,
   *  D-FW-14): mark it seen without opening step 0. */
  seen: () => void;
} {
  const { arcId, message, next } = args;
  const [open, setOpen] = useState(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  const has = message !== null;
  const key = coachWordKey(arcId, message);
  // Read after mount: browser storage is not there on the server render.
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    setUnseen(key !== null && !coachWordSeen(key));
  }, [key]);

  const show = useCallback(() => {
    if (!has) return false;
    markCoachWordSeen(key);
    setUnseen(false);
    setOpen(true);
    return true;
  }, [has, key]);
  const close = useCallback(() => setOpen(false), []);
  const seen = useCallback(() => {
    markCoachWordSeen(key);
    setUnseen(false);
  }, [key]);
  const proceed = useCallback(() => {
    close();
    nextRef.current();
  }, [close]);
  return { open, unseen, show, proceed, close, seen };
}
