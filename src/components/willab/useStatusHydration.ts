"use client";

import { useEffect, useRef } from "react";
import { fetchReadoutsForStatus } from "@/services/api/readouts";
import { afterChatBoot } from "@/lib/chatBoot";
import {
  clearReviewPending,
  getReviewPending,
  setInsightsReady,
  setReviewPending,
} from "./sendStatus";
import type { HomeStatus, WillabState } from "./useWillabFlow";

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
  ownerId: string,
  settle: (status: HomeStatus) => void,
  opts: { refresh?: boolean } = {},
): Promise<boolean> {
  const result = await fetchReadoutsForStatus(ownerId, opts);
  // An unavailable readout list is not an empty list. Keep the session-state
  // answer and the local pending chip intact; the chat is already usable and
  // a later state-change refresh can recover without a visual jump.
  if (!result.ok) return false;

  const rows = result.rows;
  const latest = rows[0];
  if (latest?.state === "review_pending") {
    setReviewPending(latest.sessionId);
    settle("review_pending");
  } else if (getReviewPending() != null) {
    setInsightsReady(latest?.sessionId ?? getReviewPending()!);
    clearReviewPending();
    settle("insights_ready");
  } else {
    clearReviewPending();
    settle("lounge_idle");
  }
  return true;
}

export function useStatusHydration(
  signedIn: boolean | null,
  ownerId: string | null,
  state: WillabState | null,
  settle: (status: HomeStatus) => void
): void {
  const ranRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  if (ownerRef.current !== ownerId) {
    ownerRef.current = ownerId;
    ranRef.current = false;
    generationRef.current += 1;
  }

  useEffect(() => {
    if (signedIn !== true || !ownerId || state === null || ranRef.current) return;
    ranRef.current = true; // once, on the first resolved signed-in load
    if (state !== "lounge_idle" && state !== "review_pending") return;

    const generation = generationRef.current;
    return afterChatBoot(() => {
      void reconcileWillabStatus(ownerId, (status) => {
        if (generation === generationRef.current && ownerRef.current === ownerId) {
          settle(status);
        }
      });
    });
  }, [signedIn, ownerId, state, settle]);
}
