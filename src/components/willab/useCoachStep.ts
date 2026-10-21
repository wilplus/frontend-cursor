"use client";

import { useCallback, useRef, useState } from "react";
import type { CoachMessage } from "@/services/api/idealText";
import { markCoachFeedbackSeen } from "@/services/api/coachFeedbackSeen";

/** Step 0 of the Feedback sheet (founder 2026-09-29, Q1; Final Screens L8).
 *
 *  - NEVER opens by itself (founder 2026-09-29, answering the audit: "never
 *    opens by itself"). The speaker lands on the text and taps Review
 *    feedback; the step is the first screen of that walk.
 *  - Opens FIRST whenever the speaker starts the walk, so it can always be
 *    read again.
 *  - Continue calls `next` (the host's "go to the first waiting moment"),
 *    which does nothing when nothing waits.
 *  - REACHABLE WHILE UNSEEN (founder 2026-10-05; backend N77): `unseen` says
 *    the word for the Take on screen has not been watched yet, so the host
 *    keeps "Review feedback" on the page for it even after every moment is
 *    answered.
 *  - WATCHED ANYWHERE IS WATCHED (founder 2026-10-19, N80, D4 and D7): the
 *    server says whether the word is new (`message.unseen`), per Take, so a
 *    word watched in WhatsApp's in-app browser or on another device is not
 *    new here, and a word the coach changed (its words or its video) is new
 *    again. Only Continue (or the update's Close) marks it watched; showing
 *    the step and ✕ do not (the approved drawing). `seen()` tells the server
 *    and clears it here at once, until the server sends another version.
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
  /** The speaker watched the word (Continue on step 0 in the Feedback walk,
   *  D-FW-14): the server hears it, and it is no longer new here. */
  seen: () => void;
} {
  const { message, next } = args;
  const [open, setOpen] = useState(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  const has = message !== null;
  // The version watched on this page: a changed word or video is another.
  const version = versionOf(message);
  const [watched, setWatched] = useState<string | null>(null);
  const unseen = message?.unseen === true && version !== watched;

  const show = useCallback(() => {
    if (!has) return false;
    setOpen(true);
    return true;
  }, [has]);
  const close = useCallback(() => setOpen(false), []);
  const take = message?.takeSessionId ?? null;
  const seen = useCallback(() => {
    setWatched(version);
    if (take) void markCoachFeedbackSeen({ takeSessionId: take });
  }, [version, take]);
  const proceed = useCallback(() => {
    seen();
    close();
    nextRef.current();
  }, [seen, close]);
  return { open, unseen, show, proceed, close, seen };
}

/** One version of the word: its Take, its words and its video (the link
 *  without its signature, which every read signs afresh). */
function versionOf(message: CoachMessage | null): string | null {
  if (!message) return null;
  const video = (message.videoUrl ?? "").split("?")[0];
  return [message.takeSessionId ?? "", message.text ?? "", video].join("\u0000");
}
