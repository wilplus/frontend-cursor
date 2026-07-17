"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { AcousticRead } from "@/services/api/coachReview";
import type { ReadoutFeatures } from "./readout";
import { db, hz, pct, wpm } from "./SpeechDataPanel";

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
  features = null,
}: {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  /** #190 — the coach-only stress↔charisma verdict. COACH-ONLY. */
  acousticRead?: AcousticRead | null;
  /** FE-7 — the raw per-snippet acoustic vector for the "Show more" disclosure
   *  under the needle. Coach-only surface — numbers are allowed here. */
  features?: ReadoutFeatures | null;
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
      {acousticRead ? (
        <AcousticPotentiometer read={acousticRead} features={features} />
      ) : null}
    </>
  );
}

/** #190 — the stress↔charisma potentiometer (coach-only). A horizontal gauge
 *  with the needle at the read's position (-1 stress … +1 charisma), plus a
 *  "potentially a key moment" nudge when the read fell outside the normal range.
 *  The needle itself renders no number; FE-7 adds a collapsed "Show more"
 *  disclosure with the raw per-snippet acoustic data underneath. */
function AcousticPotentiometer({
  read,
  features,
}: {
  read: AcousticRead;
  features: ReadoutFeatures | null;
}) {
  // -1..1 → 0..100% (left = stress, right = charisma).
  const pos = ((read.potentiometer + 1) / 2) * 100;
  const [expanded, setExpanded] = useState(false);
  // FE-7 — what the needle was z-scored against (BE `baseline`).
  const baselineLabel =
    read.baseline === "user"
      ? "vs the speaker's baseline"
      : read.baseline === "parent_take"
      ? "vs the original take"
      : read.baseline === "take"
      ? "within this take"
      : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Acoustic read
          {baselineLabel ? (
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              · {baselineLabel}
            </span>
          ) : null}
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

      {/* FE-7 — the raw acoustic data behind the needle. Coach-only numbers,
          collapsed by default. */}
      {features ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-0.5 flex items-center gap-1 self-start text-[11px] font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            )}
            {expanded ? "Show less" : "Show more"}
          </button>
          {expanded ? <AcousticDetail features={features} /> : null}
        </>
      ) : null}
    </div>
  );
}

/** FE-7 — the expanded raw per-snippet vector. Shared-unit figures format via
 *  the SpeechDataPanel formatters (one rounding, coach and user surfaces can't
 *  drift); the derived unit-less metrics render locally. Every value degrades
 *  on null since older packets carry partial features. */
function AcousticDetail({ features: f }: { features: ReadoutFeatures }) {
  const n = (v: number | null, digits: number): string =>
    v === null ? "—" : v.toFixed(digits);
  const rows: [string, string][] = [
    ["Pitch mean", hz(f.f0Mean)],
    ["Pitch variability", hz(f.f0Sd)],
    ["Pitch slope", n(f.f0Slope, 2)],
    ["Pitch shift, mid to end", n(f.f0MidEndDelta, 2)],
    [
      "Speech rate",
      f.speechRate === null
        ? "—"
        : `${wpm(f.speechRate)}${
            f.speechRatePct !== null ? ` (${f.speechRatePct}% of 125)` : ""
          }`,
    ],
    ["Mean pause", f.meanPause === null ? "—" : `${n(f.meanPause, 2)} s`],
    ["Pause ratio", pct(f.pauseRatio)],
    ["Pause regularity", n(f.pauseRegularity, 2)],
    ["Loudness range", db(f.loudnessRange)],
    ["Intensity envelope", n(f.intensityEnvelope, 2)],
    ["Voiced ratio", pct(f.voicedRatio)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="text-[12px] font-medium tabular-nums text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
