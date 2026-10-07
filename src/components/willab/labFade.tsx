"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./useRecordingGestures";
import type { WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  labFade — the soft 0.4 s fade into and out of Recording Mode               */
/*  (walk lock 2026-10-06, "How screens move": Recording Mode fades, 0.4 s;    */
/*  founder 2026-10-07, Q-B14 A (3): "a soft 0.4-second fade into the white    */
/*  recording screens"; build plan D-RC-7).                                    */
/*                                                                            */
/*  Two moves, both CSS (`.lab-fade-in`, `.lab-fade-out` in globals.css):      */
/*                                                                            */
/*    in   the Lab overlay fades in over the Lounge when it opens for a Take, */
/*         and the recording column fades in again when the text's "Record   */
/*         Take N" moves readout -> lab_recording;                            */
/*    out  when the Lab closes, a white veil fades out over the Lounge for   */
/*         the same 0.4 s (LabFadeOut), so the screens leave as they came.   */
/*                                                                            */
/*  NEVER ON THE LIVE LOOP'S CLOCK. The fade is paint only: nothing here      */
/*  waits, delays or wraps `take_started`, `mic.start` or the close itself,   */
/*  and the veil takes no pointer events. With reduce motion both moves are   */
/*  instant (CSS), and the veil is not drawn at all.                          */
/* -------------------------------------------------------------------------- */

export const LAB_FADE_MS = 400;

/** The class that fades a screen in over LAB_FADE_MS. */
export const LAB_FADE_IN_CLASS = "lab-fade-in";

/** The recording column fades in again when it is entered FROM the text
 *  (readout -> lab_recording). Any other way into lab_recording is part of
 *  the overlay's own opening fade. Returns the class to add, or "" . */
export function useRecordingEntryFade(state: WillabState): string {
  const previous = useRef<WillabState>(state);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const from = previous.current;
    previous.current = state;
    if (state === "lab_recording" && from === "readout") setFading(true);
    else if (state !== "lab_recording") setFading(false);
  }, [state]);
  return fading ? LAB_FADE_IN_CLASS : "";
}

/** The veil that fades out over the Lounge once the Lab has closed. Mount it
 *  beside the Lab overlay with the overlay's `open`; it draws nothing while
 *  the Lab is open or after its 0.4 s. */
export function LabFadeOut({ open }: { open: boolean }) {
  const wasOpen = useRef(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    if (!was || open) return;
    if (prefersReducedMotion()) return;
    setLeaving(true);
    const timer = window.setTimeout(() => setLeaving(false), LAB_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (!leaving) return null;
  return (
    <div
      aria-hidden="true"
      data-lab-fade-out
      className="lab-fade-out pointer-events-none fixed inset-0 z-30 bg-background"
    />
  );
}
