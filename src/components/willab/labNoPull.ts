"use client";

import type { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import {
  useNoPullToRefresh,
  useTouchPullBelt,
} from "@/lib/willab/useNoPullToRefresh";
import type { WillabState } from "./useWillabFlow";

type MicStatus = ReturnType<typeof useDualCaptureMic>["state"]["status"];

/** The span in which the Take lives only in this tab: from the first sound
 *  until processing ends. A browser reload anywhere in it loses the Take, so
 *  pull-to-refresh is held off for exactly this span (founder 2026-10-06). */
export function takeOnlyInThisTab(state: WillabState, micStatus: MicStatus): boolean {
  return (
    state === "lab_recording" ||
    state === "lab_processing" ||
    micStatus === "recording"
  );
}

/** "Getting your mic ready" before a later Take (and the training question
 *  that may come first): no pull-to-refresh either (founder lock 2026-10-07,
 *  the recording screens: "no page reload or pull-to-refresh, ever"). */
export function labPrerecordNoPull(state: WillabState): boolean {
  return state === "lab_prerecord";
}

/** The Lab's whole no-pull rule, in one call. iOS before 16 ignores the
 *  root's overscroll-behavior, so the touch belt is worn for the same span:
 *  the mic wait and the processing screen have no gesture hook of their own
 *  (the prototype cancels every touch move off a scroller, on every screen). */
export function useLabNoPull(state: WillabState, micStatus: MicStatus): void {
  const noPull = takeOnlyInThisTab(state, micStatus) || labPrerecordNoPull(state);
  useNoPullToRefresh(noPull);
  useTouchPullBelt(noPull);
}
