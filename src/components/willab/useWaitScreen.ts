"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  readProcessingTake,
  type ProcessingPhase,
  type ProcessingTake,
  type ProcessingTakeProgress,
} from "@/lib/willab/processingTake";
import { WALK_STEP_SELECTOR } from "@/lib/willab/lensScreen";
import {
  LENS_SCREEN_SELECTOR,
  WAIT_LOOK_MS,
  waitLifts,
} from "@/lib/willab/waitHandover";

/* -------------------------------------------------------------------------- */
/*  useWaitScreen — the Lounge's full-screen wait, from the Lab to the walk.   */
/*                                                                            */
/*  Two moments used to break the one wait (founder 2026-10-21):               */
/*                                                                            */
/*  1. "It starts on the screen and then automatically closes and opens the    */
/*     lounge; it is abrupt; make it stay." Once the server holds the Take,    */
/*     the Lab hands the job to the Lounge and closes. The Lounge now shows    */
/*     its view of that same wait in the same commit, before the browser       */
/*     paints, so the screen never changes. Its ✕ still shows the chat.        */
/*  2. "When it says it's done it opens the walk automatically but then it     */
/*     still loads the walk." The wait closed when the text was stored and     */
/*     the lens opened on its own loading frame. Now the wait stays over the   */
/*     lens until the walk is on screen (lib/willab/waitHandover).             */
/*  3. "From the Take straight into the walk" (founder 2026-11-01, N319 item  */
/*     10): the wait over the lens comes from the Take's own marker, so it    */
/*     covers even when the Lounge was not following that job (the speaker   */
/*     came back to the app, or left the wait for the chat): the chat is     */
/*     never shown between the processing and the walk.                      */
/*                                                                            */
/*  Presentation only: the Lounge still owns the job, the marker and the       */
/*  settle; this decides which wait, if any, is on screen.                     */
/* -------------------------------------------------------------------------- */

/** One job's wait as the Lounge shows it. */
export interface WaitView {
  sessionId: string;
  takeIndex: number | null;
  status: "analyzing" | "failed";
  startedAt: number;
  progress: ProcessingTakeProgress | null;
  phase: ProcessingPhase;
  phaseStartedAt: number;
}

export function useWaitScreen({
  userId,
  signedIn,
  labOpen,
  handedOver,
  onHandedOverShown,
  resume,
  openedSessionId,
  show,
}: {
  userId: string | null;
  signedIn: boolean;
  labOpen: boolean;
  /** The Take the Lab just handed over, until it is on screen here. */
  handedOver: string | null | undefined;
  onHandedOverShown: (() => void) | undefined;
  /** The job the Lounge is following, and the one its view is open on. */
  resume: WaitView | null;
  openedSessionId: string | null;
  /** Open the Lounge's view on this job. */
  show: (view: WaitView) => void;
}): {
  /** The wait to draw full screen, or null. */
  view: WaitView | null;
  /** The review is opening for this Take: keep its wait over the lens. */
  coverWalk: (take: ProcessingTake) => void;
  /** The speaker's ✕: no wait covers anything any more. */
  lift: () => void;
} {
  const latest = useRef({ resume, signedIn, show, onHandedOverShown });
  latest.current = { resume, signedIn, show, onHandedOverShown };

  // 1 — the Lab's wait, shown here before the first paint without the Lab.
  useLayoutEffect(() => {
    if (!handedOver || labOpen) return;
    latest.current.onHandedOverShown?.();
    const marker = readProcessingTake(userId);
    if (marker?.sessionId !== handedOver || marker.status !== "processing") return;
    latest.current.show({
      sessionId: marker.sessionId,
      takeIndex: marker.takeIndex,
      status: "analyzing",
      startedAt: marker.startedAt,
      progress: marker.progress,
      phase: marker.phase,
      phaseStartedAt: marker.phaseStartedAt,
    });
  }, [handedOver, labOpen, userId]);

  // 2 — the wait over the lens, until the walk is there.
  const [cover, setCover] = useState<(WaitView & { coveredAt: number }) | null>(null);
  const coverWalk = useCallback((take: ProcessingTake) => {
    const shown = latest.current.resume;
    const view = shown?.sessionId === take.sessionId ? shown : waitViewOf(take);
    // A guest's text opens behind its own ask, which the wait must not hide.
    if (!latest.current.signedIn || view.status !== "analyzing") return;
    setCover({ ...view, coveredAt: Date.now() });
  }, []);
  const lift = useCallback(() => setCover(null), []);
  useEffect(() => {
    if (!cover) return;
    let lensSeen = false;
    const look = setInterval(() => {
      const lensOn = document.querySelector(LENS_SCREEN_SELECTOR) !== null;
      lensSeen ||= lensOn;
      const lifts = waitLifts({
        stepOnScreen: document.querySelector(WALK_STEP_SELECTOR) !== null,
        lensSeen,
        lensOn,
        elapsedMs: Date.now() - cover.coveredAt,
      });
      if (lifts) setCover(null);
    }, WAIT_LOOK_MS);
    return () => clearInterval(look);
  }, [cover]);

  const live =
    resume?.status === "analyzing" && resume.sessionId === openedSessionId ? resume : null;
  return { view: live ?? cover, coverWalk, lift };
}

/** A Take's wait from its own marker, for the cover when the Lounge was not
 *  following that job (N319 item 10). Pure. */
export function waitViewOf(take: ProcessingTake): WaitView {
  return {
    sessionId: take.sessionId,
    takeIndex: take.takeIndex,
    status: take.status === "processing" ? "analyzing" : "failed",
    startedAt: take.startedAt,
    progress: take.progress,
    phase: take.phase,
    phaseStartedAt: take.phaseStartedAt,
  };
}
