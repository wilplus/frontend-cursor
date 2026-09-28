"use client";

import { useEffect, useState } from "react";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  THE PRACTICE RECORDING STATE (founder 2026-09-26, accepted coach journey:  */
/*  "Practise: record an attempt. The coach's comment stays on screen.").      */
/*                                                                            */
/*  Reported 2026-09-28: "for the practise when you hit record no new screen   */
/*  appears and on your screen it does appear". Tapping Practise only turned   */
/*  the pill into Stop; the video, your clip and the story stayed exactly as  */
/*  they were, so nothing said the mic was live. While recording, the sheet   */
/*  now shows only what you need: the coach's words, a large pulsing record   */
/*  mark, and which attempt this is with its running time.                    */
/*                                                                            */
/*  AC-9: the time is a clock, not a score, and the attempt number is a       */
/*  position ("attempt 2"), never "2 of 3" or anything that grades.           */
/* -------------------------------------------------------------------------- */

export default function PracticeRecordingView({
  instruction,
  attempt,
}: {
  instruction: string | null;
  attempt: number;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div data-testid="practice-recording" className="flex min-h-[50dvh] flex-col gap-4">
      {instruction?.trim() ? (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[15px] leading-relaxed text-foreground">{instruction}</p>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <span className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-record/20 motion-safe:animate-ping" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-foreground">
            <span className="h-8 w-8 rounded-lg bg-record" />
          </span>
        </span>
        <p role="status" className="font-mono text-[17px] font-semibold tabular-nums text-foreground">
          {COPY.practiceAttemptRecording(attempt)} · {clock}
        </p>
      </div>
    </div>
  );
}
