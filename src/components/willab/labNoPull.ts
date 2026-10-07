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
 *  the recording screens: "no page reload or pull-to-refresh, ever"). This
 *  screen has no gesture hook of its own, so it also wears the belt. */
export function labPrerecordNoPull(state: WillabState): boolean {
  return state === "lab_prerecord";
}

/** The Lab's whole no-pull rule, in one call. */
export function useLabNoPull(state: WillabState, micStatus: MicStatus): void {
  useNoPullToRefresh(
    takeOnlyInThisTab(state, micStatus) || labPrerecordNoPull(state),
  );
  useTouchPullBelt(labPrerecordNoPull(state));
}
