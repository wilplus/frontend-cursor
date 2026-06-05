"use client";

import { useEffect, useRef } from "react";
import { fetchReadouts } from "@/services/api/readouts";
import { clearReviewPending, setReviewPending } from "./sendStatus";
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

    void fetchReadouts().then((rows) => {
      const latest = rows[0]; // newest first
      if (latest?.state === "review_pending") {
        setReviewPending(latest.sessionId);
        if (state !== "review_pending") goTo("review_pending");
      } else {
        clearReviewPending();
        if (state === "review_pending") goTo("lounge_idle");
      }
    });
  }, [signedIn, state, goTo]);
}
