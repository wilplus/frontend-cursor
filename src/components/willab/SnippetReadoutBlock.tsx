"use client";

import MediaPlayer from "@/components/results/MediaPlayer";
import type { AcousticRead } from "@/services/api/coachReview";

/* -------------------------------------------------------------------------- */
/*  SnippetReadoutBlock — the snippet readout block in the COACH review card.  */
/*                                                                            */
/*  #191 — narrowed to key moments. The coach sees only:                       */
/*    - MediaPlayer (playback of the exact span)                               */
/*    - the transcript (what was said, so the coach can comment)               */
/*    - the acoustic potentiometer (stress↔charisma) + a "potentially a key    */
/*      moment" marker when the read fell outside the normal range             */
/*                                                                            */
/*  Dropped from the coach card (founder, #191): the machine tone comment, the */
/*  say-it-stronger suggestions, and every acoustic score / stickiness number  */
/*  — the potentiometer IS the acoustic read now. Nothing here is user-facing. */
/* -------------------------------------------------------------------------- */

export default function SnippetReadoutBlock({
  audioRef,
  startOffsetMs,
  durationMs,
  transcript,
  acousticRead = null,
}: {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  /** #190 — the coach-only stress↔charisma verdict. COACH-ONLY. */
  acousticRead?: AcousticRead | null;
}) {
  return (
    <>
      {/* Playback FIRST (directly below the slide) → then the transcript. */}
      <div className="flex flex-col gap-3">
        <MediaPlayer
          src={audioRef}
          startOffsetMs={startOffsetMs}
          durationMs={durationMs}
        />
        {transcript ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
            <p className="text-[15px] leading-relaxed text-foreground">
              {transcript}
            </p>
          </div>
        ) : null}
      </div>

      {/* #190/#191 — coach-only acoustic verdict: stress↔charisma needle + a
          "potentially a key moment" marker. Never shown on any user surface. */}
      {acousticRead ? <AcousticPotentiometer read={acousticRead} /> : null}
    </>
  );
}

/** #190 — the stress↔charisma potentiometer (coach-only). A horizontal gauge
 *  with the needle at the read's position (-1 stress … +1 charisma), plus a
 *  "potentially a key moment" nudge when the read fell outside the normal range.
 *  Renders no number — the needle position IS the read. */
function AcousticPotentiometer({ read }: { read: AcousticRead }) {
  // -1..1 → 0..100% (left = stress, right = charisma).
  const pos = ((read.potentiometer + 1) / 2) * 100;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Acoustic read
        </p>
        {read.outsideNormalRange ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Potentially a key moment
          </span>
        ) : null}
      </div>
      <div
        role="img"
        aria-label="Stress to charisma acoustic read"
        className="relative h-2 rounded-full bg-gradient-to-r from-amber-500/50 via-muted to-primary/60"
      >
        {/* neutral (center) tick */}
        <span
          className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-border"
          aria-hidden
        />
        {/* the needle */}
        <span
          className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>stress</span>
        <span>charisma</span>
      </div>
    </div>
  );
}
