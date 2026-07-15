"use client";

import MediaPlayer from "@/components/results/MediaPlayer";
import type { ReadoutFeatures, ReadoutStickiness } from "./readout";
import type { AcousticRead } from "@/services/api/coachReview";

/* -------------------------------------------------------------------------- */
/*  SnippetReadoutBlock — the snippet readout block in the COACH review card.  */
/*                                                                            */
/*  Unified with the user readout's per-slide design, but EVERYTHING is shown */
/*  (the coach reads the whole snippet without tapping). Anatomy:             */
/*    - MediaPlayer (FIRST, directly below the slide — readout order)          */
/*    - Transcript card (warm orange tint, the readout standard)               */
/*    - Hero pair: speed (`179 wpm (143%)`) + pause ratio                    */
/*    - Full acoustic metrics — always visible (no Show-details toggle)        */
/*    - Topic stickiness                                                      */
/*                                                                            */
/*  Speed display (FE-1d): `{wpm} wpm ({pct}%)`. If BE omits speechRate,     */
/*  gross WPM is computed from transcript + durationMs as a fallback; the    */
/*  pct uses speechRatePct when present or the 125-wpm reference otherwise.  */
/* -------------------------------------------------------------------------- */

const DASH = "—";
const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : DASH);
const sec = (v: number | null) => (v != null ? `${v.toFixed(1)}s` : DASH);
const dB = (v: number | null) => (v != null ? `${Math.round(v)} dB` : DASH);
const pct = (v: number | null) => (v != null ? `${Math.round(v * 100)}%` : DASH);
const dec = (v: number | null) => (v != null ? v.toFixed(2) : DASH);

function grossWpm(transcript: string, durationMs: number): number | null {
  if (durationMs <= 0) return null;
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return null;
  return words / (durationMs / 60000);
}

function formatSpeed(
  speechRate: number | null,
  speechRatePct: number | null,
  transcript: string,
  durationMs: number
): string {
  const wpm = speechRate ?? grossWpm(transcript, durationMs);
  if (wpm == null) return DASH;
  const p = speechRatePct ?? Math.round((wpm / 125) * 100);
  return `${Math.round(wpm)} wpm (${p}%)`;
}

export default function SnippetReadoutBlock({
  audioRef,
  startOffsetMs,
  durationMs,
  transcript,
  stickiness,
  features,
  acousticRead = null,
  autoComment = null,
}: {
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  stickiness: ReadoutStickiness;
  features: ReadoutFeatures | null;
  /** #190 — the coach-only stress↔charisma verdict. COACH-ONLY. */
  acousticRead?: AcousticRead | null;
  /** #190 — the machine's tone comment (BE-worded; never FE-synthesized). */
  autoComment?: string | null;
}) {
  const f = features;

  return (
    <>
      {/* Playback FIRST (directly below the slide) → then the transcript — same
          order + look as the user readout. Everything is shown; no tap. */}
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

      {/* #190 — coach-only acoustic verdict: stress↔charisma needle + the
          machine's tone comment (BE-worded). Never shown on any user surface. */}
      {acousticRead ? <AcousticPotentiometer read={acousticRead} /> : null}
      {autoComment ? (
        <p className="text-[13px] italic leading-relaxed text-muted-foreground">
          {autoComment}
        </p>
      ) : null}

      {/* Hero pair */}
      <div className="flex gap-10">
        <div>
          <p className="text-[22px] font-semibold tabular-nums text-foreground">
            {formatSpeed(
              f?.speechRate ?? null,
              f?.speechRatePct ?? null,
              transcript,
              durationMs
            )}
          </p>
          <p className="text-[12px] text-muted-foreground">speed</p>
        </div>
        <div>
          <p className="text-[22px] font-semibold tabular-nums text-foreground">
            {f?.pauseRatio != null ? `${Math.round(f.pauseRatio * 100)}%` : DASH}
          </p>
          <p className="text-[12px] text-muted-foreground">pause ratio</p>
        </div>
      </div>

      {/* Full metrics — always visible (no toggle); coach sees more than the user. */}
      {f ? (
        <div className="flex flex-col gap-2">
          <DetailRow
            label="Pitch"
            value={`F0 mean ${hz(f.f0Mean)} · SD ${hz(f.f0Sd)}`}
          />
          <DetailRow
            label="Pace & pauses"
            value={`mean pause ${sec(f.meanPause)}`}
          />
          <DetailRow
            label="Volume & voice"
            value={`range ${dB(f.loudnessRange)} · voiced ${pct(f.voicedRatio)}`}
          />
          <DetailRow label="F0 slope" value={dec(f.f0Slope)} />
          <DetailRow label="Pause regularity" value={dec(f.pauseRegularity)} />
          <DetailRow
            label="Intensity envelope"
            value={dec(f.intensityEnvelope)}
          />
          <DetailRow label="F0 mid→end Δ" value={dec(f.f0MidEndDelta)} />
        </div>
      ) : null}

      {/* Topic stickiness */}
      {(stickiness.comment || stickiness.composite != null) && (
        <div>
          <p className="text-sm font-semibold text-foreground">
            Topic stickiness
          </p>
          {stickiness.comment ? (
            <p className="mt-1.5 text-[14px] italic leading-relaxed text-foreground">
              {stickiness.comment}
            </p>
          ) : null}
          {stickiness.composite != null ? (
            <p className="mt-1 text-[14px] text-muted-foreground">
              composite {dec(stickiness.composite)}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

/** #190 — the stress↔charisma potentiometer (coach-only). A horizontal gauge
 *  with the needle at the read's position (-1 stress … +1 charisma), plus a
 *  "worth a listen" nudge when the read fell outside the normal range. Renders
 *  no number — the needle position IS the read. */
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
            Worth a listen
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-[13px] text-foreground">{value}</span>
    </div>
  );
}
