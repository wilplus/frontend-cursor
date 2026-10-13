"use client";

import { useEffect, useRef, useState } from "react";
import { SETTLE_CEILING_MS } from "@/lib/willab/enrichmentSettle";

/** THE PAGE IS NOT THE LANDING SCREEN (lock 2026-10-12, sections 1 and 4).
 *  After a Take the wait stays on screen until the lens opens by itself; ✕
 *  on the lens shows the chat, and the page opens after the summary. With
 *  nothing to review once the feedback is in, the speaker goes to the chat.
 *  True while the page is still covered by the wait. */
export function useReadoutLanding(args: {
  /** A moment (or the coach's word) waits: the lens opens. */
  reviewWaiting: boolean;
  analysisPending: boolean;
  /** The page reads a served document at all only with both. */
  canRead: boolean;
  arcId: string | null;
  sdSettled: boolean;
  feedbackPending: boolean;
  hasDocument: boolean;
  onClose?: () => void;
}): boolean {
  const { reviewWaiting, analysisPending, sdSettled, feedbackPending, hasDocument } = args;
  const reading = args.canRead && Boolean(args.arcId);
  const [lensOn, setLensOn] = useState(false);
  const [landed, setLanded] = useState(false);
  const closeRef = useRef(args.onClose);
  closeRef.current = args.onClose;
  useEffect(() => {
    if (reviewWaiting) setLensOn(true);
  }, [reviewWaiting]);
  // The page's patience for feedback bounds the wait too.
  const [waitSpent, setWaitSpent] = useState(false);
  useEffect(() => {
    if (!sdSettled) return;
    const timer = setTimeout(() => setWaitSpent(true), SETTLE_CEILING_MS);
    return () => clearTimeout(timer);
  }, [sdSettled]);
  useEffect(() => {
    if (lensOn || landed || analysisPending) return;
    // Without a read the page is all there is.
    if (reading && (!sdSettled || (feedbackPending && !waitSpent) || reviewWaiting)) return;
    // A beat for the deck to report what waits before deciding nothing does.
    const timer = setTimeout(() => {
      if (hasDocument && closeRef.current) closeRef.current();
      else setLanded(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [lensOn, landed, analysisPending, reading, sdSettled, feedbackPending, waitSpent, reviewWaiting, hasDocument]);
  return !lensOn && !landed;
}
