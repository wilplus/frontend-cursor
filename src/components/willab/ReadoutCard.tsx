"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — the core payoff screen (§5)                                  */
/*                                                                            */
/*  "Here's your voice as data" — neutral, factual, NON-interpretive (the      */
/*  verdict is the coach's job). Sequential reveal (one snippet at a time,      */
/*  tap-to-advance) → scrollable list to revisit. Hero pair (speech rate +      */
/*  pause ratio) as Display; the other 8 features grouped Pitch / Pace &        */
/*  Pauses / Volume & Voice, with the 4 derived behind "Show dynamics".         */
/*  Stickiness is comment-first, score-second, neutral (no red/green).         */
/*  Reused by the coach-authoring view (§14). Reuses MediaPlayer for playback. */
/* -------------------------------------------------------------------------- */

const DASH = "—";
const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : DASH);
const sec = (v: number | null) => (v != null ? `${v.toFixed(1)}s` : DASH);
const dB = (v: number | null) => (v != null ? `${Math.round(v)} dB` : DASH);
const pct = (v: number | null) => (v != null ? `${Math.round(v * 100)}%` : DASH);
const dec = (v: number | null) => (v != null ? v.toFixed(2) : DASH);

export default function ReadoutCard({
  payload,
  isSample = false,
  onSend,
  onExplain,
}: {
  payload: ReadoutPayload;
  isSample?: boolean;
  onSend: () => void;
  onExplain: () => void;
}) {
  const { snippets } = payload;
  const total = snippets.length;
  // Sequential reveal → list. One card at a time until the user has seen them
  // all (or taps "See all"), then the full scrollable list.
  const [cursor, setCursor] = useState(0);
  const [showAll, setShowAll] = useState(total <= 1);

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[15px] text-muted-foreground">
          No analyzable snippets in this recording.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {isSample && (
        <p className="mb-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
          Sample data — your real acoustic Readout wires in at seam ③.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {showAll
          ? snippets.map((s, i) => (
              <SnippetCard key={s.id || i} snippet={s} index={i} total={total} />
            ))
          : (
              <SnippetCard
                snippet={snippets[cursor]}
                index={cursor}
                total={total}
              />
            )}
      </div>

      {!showAll && (
        <div className="mt-4 flex justify-center">
          {cursor < total - 1 ? (
            <Button
              variant="outline"
              onClick={() => setCursor((c) => c + 1)}
              className="rounded-full px-6"
            >
              Next snippet →
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowAll(true)}
              className="rounded-full px-6"
            >
              See all {total} →
            </Button>
          )}
        </div>
      )}

      <p className="mt-5 text-center text-[12px] leading-relaxed text-muted-foreground">
        Your personal baseline builds over your first few sessions; these are raw
        values.
      </p>
      <button
        type="button"
        onClick={onExplain}
        className="mt-2 text-center text-[13px] text-primary underline-offset-2 hover:underline"
      >
        ▸ What do these mean?
      </button>

      {/* persistent send footer (§5.7) */}
      <div className="sticky bottom-0 -mx-4 mt-5 border-t border-border bg-background px-4 py-3">
        <Button onClick={onSend} className="w-full rounded-full">
          Send to my coach for analysis
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- snippet card ----------------------------- */

function SnippetCard({
  snippet,
  index,
  total,
}: {
  snippet: ReadoutSnippet;
  index: number;
  total: number;
}) {
  const f = snippet.features;
  const [showDynamics, setShowDynamics] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          Snippet {index + 1} of {total}
        </span>
      </div>

      <MediaPlayer
        src={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
      />

      {snippet.transcript ? (
        <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-[15px] italic leading-relaxed text-foreground">
          {snippet.transcript}
        </blockquote>
      ) : null}

      {/* hero pair (Display) */}
      <div className="mt-4 flex gap-10">
        <Hero
          value={f.speechRate}
          label="speech rate"
          fmt={(v) => `${Math.round(v)} wpm`}
        />
        <Hero
          value={f.pauseRatio}
          label="pause ratio"
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      {/* grouped rest */}
      <div className="mt-4 flex flex-col gap-2">
        <Group label="Pitch" value={`F0 mean ${hz(f.f0Mean)} · SD ${hz(f.f0Sd)}`} />
        <Group
          label="Pace & pauses"
          value={`mean pause ${sec(f.meanPause)}`}
        />
        <Group
          label="Volume & voice"
          value={`range ${dB(f.loudnessRange)} · voiced ${pct(f.voicedRatio)}`}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowDynamics((s) => !s)}
        className="mt-3 text-[12px] text-muted-foreground hover:text-foreground"
      >
        {showDynamics ? "▾" : "▸"} Show dynamics
      </button>
      {showDynamics && (
        <div className="mt-2 flex flex-col gap-2">
          <Group label="F0 slope" value={dec(f.f0Slope)} />
          <Group label="Pause regularity" value={dec(f.pauseRegularity)} />
          <Group label="Intensity envelope" value={dec(f.intensityEnvelope)} />
          <Group label="F0 mid→end Δ" value={dec(f.f0MidEndDelta)} />
        </div>
      )}

      {/* stickiness — comment first, score second, neutral */}
      <div className="mt-4 border-t border-border pt-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Stickiness
        </span>
        {snippet.stickiness.comment ? (
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">
            {snippet.stickiness.comment}
          </p>
        ) : null}
        {snippet.stickiness.composite != null ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            composite {dec(snippet.stickiness.composite)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Hero({
  value,
  label,
  fmt,
}: {
  value: number | null;
  label: string;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-[22px] font-semibold tabular-nums text-foreground">
        {value != null ? fmt(value) : DASH}
      </p>
      <p className="text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Group({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-[13px] text-foreground">{value}</span>
    </div>
  );
}
