"use client";

import { useEffect, useRef } from "react";
import { fetchReadouts } from "@/services/api/readouts";
import {
  clearReviewPending,
  getReviewPending,
  setInsightsReady,
  setReviewPending,
} from "./sendStatus";
import type { WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  useStatusHydration — reconcile the at-home status with server truth (§6a) */
/*                                                                            */
/*  The send gate sets a local review_pending flag for instant feedback; this  */
/*  corrects it against the server's latest Readout state once on load (signed  */
/*  in). Latest = review_pending → keep the chip; otherwise clear it (e.g. the  */
/*  coach published → insights_ready, and the insight card in the thread now    */
/*  carries it). Runs once, and only from the at-home states — never            */
/*  interrupts onboarding or the Lab.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile the at-home status against server truth (§6a single-active model:
 * newest readout = the relevant session). Shared by the on-load hook AND the
 * live publish signal, so one logic drives the status — no second write.
 *   - newest is review_pending → review_pending
 *   - we were waiting and it moved off review_pending (the only forward move is
 *     publish; detected by the state change, since the BE pins no "published"
 *     string) → insights_ready
 *   - otherwise → lounge_idle
 */
export async function reconcileWillabStatus(
  goTo: (s: WillabState) => void
): Promise<void> {
  const rows = await fetchReadouts();
  const latest = rows[0];
  if (latest?.state === "review_pending") {
    setReviewPending(latest.sessionId);
    goTo("review_pending");
  } else if (getReviewPending() != null) {
    setInsightsReady(latest?.sessionId ?? getReviewPending()!);
    clearReviewPending();
    goTo("insights_ready");
  } else {
    clearReviewPending();
    goTo("lounge_idle");
  }
}

export function useStatusHydration(
  signedIn: boolean | null,
  state: WillabState | null,
  goTo: (s: WillabState) => void
): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (signedIn !== true || state === null || ranRef.current) return;
    ranRef.current = true; // once, on the first resolved signed-in load
    if (state !== "lounge_idle" && state !== "review_pending") return;

    void reconcileWillabStatus(goTo);
  }, [signedIn, state, goTo]);
}
