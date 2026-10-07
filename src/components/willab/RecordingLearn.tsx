"use client";

import { useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { RECORDING_COPY } from "./recordingCopy";
import { useRecordingGestures } from "./useRecordingGestures";

/* -------------------------------------------------------------------------- */
/*  The first recording's learning screen (founder lock 2026-10-07: "it       */
/*  should be scroll down to start; and no slide yet on the screen; it should  */
/*  be like a learning screen").                                              */
/*                                                                            */
/*  No slide, no clock, no Finish take. A touch screen reads "Scroll down to  */
/*  start" over a nudging chevron; a desktop draws the four arrow keys with   */
/*  the down key lit, over "Click down to start". Chosen by pointer media, so */
/*  the server render matches the client.                                     */
/*                                                                            */
/*  The microphone is already open (asked for on the tap that came here) but  */
/*  NOT recording: a swipe, a scroll, ↓, Page Down, Space, Enter or a click   */
/*  is the start. The screen glides out and `onStart` begins the recording,   */
/*  and the recording screen lands as the second half of the same move.       */
/* -------------------------------------------------------------------------- */

export default function RecordingLearn({ onStart }: { onStart: () => void }) {
  const learnRef = useRef<HTMLButtonElement | null>(null);
  const startedRef = useRef(false);
  const start = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    onStart();
  };
  const { glide } = useRecordingGestures({
    root: () => learnRef.current,
    moving: () => (learnRef.current ? [learnRef.current] : []),
    scroller: () => null,
    travel: () => 160,
    canGo: (dir) => dir > 0,
    go: () => glide(1, start),
    startKeys: true,
  });

  return (
    <button
      ref={learnRef}
      type="button"
      onClick={() => glide(1, start)}
      aria-label="Start recording"
      className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center will-change-transform"
    >
      <span className="hidden flex-col items-center gap-2.5 [@media(pointer:coarse)]:flex">
        <span className="text-[clamp(1.6rem,6vw,2.2rem)] font-semibold leading-[1.15] text-foreground opacity-[.55]">
          {RECORDING_COPY.scrollToStart}
        </span>
        <ChevronDown
          className="h-11 w-11 text-foreground opacity-[.55] motion-safe:animate-nudge"
          aria-hidden
        />
      </span>
      <span className="flex flex-col items-center gap-2.5 [@media(pointer:coarse)]:hidden">
        <span className="mb-1.5 grid grid-cols-[repeat(3,2.75rem)] gap-1.5" aria-hidden>
          <span />
          <Key icon={ChevronUp} />
          <span />
          <Key icon={ChevronLeft} />
          <Key icon={ChevronDown} lit />
          <Key icon={ChevronRight} />
        </span>
        <span className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.15] text-foreground opacity-[.55]">
          {RECORDING_COPY.clickToStart}
        </span>
      </span>
    </button>
  );
}

/** One drawn key. The lit one is the key to press, nudging (motion-safe). */
function Key({ icon: Icon, lit = false }: { icon: LucideIcon; lit?: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 opacity-70 ${
        lit
          ? "border-primary text-primary motion-safe:animate-nudge"
          : "border-muted-foreground/40 text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
