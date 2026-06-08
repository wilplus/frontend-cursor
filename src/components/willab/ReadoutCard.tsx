"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — the core payoff screen (§5), pre-judgment view               */
/*                                                                            */
/*  "Here's your voice as data" — neutral, factual, NON-interpretive (the      */
/*  verdict is the coach's job). Sequential reveal (one snippet at a time,      */
/*  tap-to-advance) → scrollable list to revisit. Reuses MediaPlayer for       */
/*  playback.                                                                   */
/*                                                                            */
/*  Anatomy (per §5 + UX-backlog T3/T5):                                        */
/*    • What — audio + transcript (italic, orange-bordered).                   */
/*    • Hero pair — speed (wpm) + pause ratio, ALWAYS visible (§5's two HERO   */
/*      numbers, the ones a non-expert feels immediately).                     */
/*    • Show details — one collapse (default collapsed) holding the grouped    */
/*      Pitch / Pace / Volume lines + the 4 derived dynamics. Hidden by        */
/*      default so the card reads calm; one tap for the full acoustic block.   */
/*    • Topic stickiness — the neutral topic-coherence read (comment first,    */
/*      composite second).                                                      */
/*                                                                            */
/*  History note: an earlier pass (d4a27f3) stripped the metric block down to  */
/*  What + Topic stickiness; UX testing flagged the missing speed/pace as a    */
/*  §5 regression (T3) and asked for the rest collapsible (T5). This restores  */
/*  the hero pair + a single collapse, keeping the Topic-stickiness section.   */
/*                                                                            */
/*  Still neutral + non-interpretive — raw values + the baseline disclaimer,   */
/*  no good/bad coloring. The verdict stays the coach's job; these are the     */
/*  facts. Reused by the coach-authoring view (§14): the optional              */
/*  `snippet.coach` block renders when a note is attached.                     */
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
  variant = "lab",
}: {
  payload: ReadoutPayload;
  isSample?: boolean;
  onSend?: () => void;
  onExplain?: () => void;
  variant?: "lab" | "insights";
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

      {payload.overallMessage ? (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
            From your coach
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

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

      {variant === "lab" ? (
        <>
          <p className="mt-5 text-center text-[12px] leading-relaxed text-muted-foreground">
            Your personal baseline builds over your first few sessions; these are
            raw values.
          </p>
          {onExplain ? (
            <button
              type="button"
              onClick={onExplain}
              className="mt-2 text-center text-[13px] text-primary underline-offset-2 hover:underline"
            >
              ▸ What do these mean?
            </button>
          ) : null}

          {/* persistent send footer (§5.7) */}
          {onSend ? (
            <div className="sticky bottom-0 -mx-4 mt-5 border-t border-border bg-background px-4 py-3">
              <Button onClick={onSend} className="w-full rounded-full">
                Send to my coach for analysis
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
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
  // Default collapsed (T5) — the card reads calm; the hero pair carries the
  // at-a-glance signal, the rest is one tap away for the curious.
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <span className="text-[12px] text-muted-foreground">
        Snippet {index + 1} of {total}
      </span>

      {/* What — audio + transcript. Mirrors AuditInsights's post-publish
          card so pre-judgment and post-publish read as the same anatomy,
          only the lens shifts. */}
      <div>
        <p className="text-sm font-semibold text-foreground">What</p>
        <div className="mt-2">
          <MediaPlayer
            src={snippet.audioRef}
            startOffsetMs={snippet.startOffsetMs}
            durationMs={snippet.durationMs}
          />
        </div>
        {snippet.transcript ? (
          <blockquote className="mt-3 border-l-2 border-primary pl-3 text-[17px] font-medium italic leading-relaxed text-foreground">
            {snippet.transcript}
          </blockquote>
        ) : null}
      </div>

      {/* Hero pair (§5 / T3) — speed + pause ratio, always visible. The two
          numbers a non-expert feels immediately; F0/Hz etc. stay below the
          fold (noise without a baseline up top). */}
      <div className="flex gap-10">
        <Hero
          value={f.speechRate}
          label="speed"
          fmt={(v) => `${Math.round(v)} wpm`}
        />
        <Hero
          value={f.pauseRatio}
          label="pause ratio"
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      {/* Show details (T5) — one collapse, default collapsed, holding the
          grouped acoustic lines + the 4 derived dynamics. */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          {showDetails ? "▾" : "▸"} Show details
        </button>
        {showDetails && (
          <div className="mt-2 flex flex-col gap-2">
            <Group
              label="Pitch"
              value={`F0 mean ${hz(f.f0Mean)} · SD ${hz(f.f0Sd)}`}
            />
            <Group label="Pace & pauses" value={`mean pause ${sec(f.meanPause)}`} />
            <Group
              label="Volume & voice"
              value={`range ${dB(f.loudnessRange)} · voiced ${pct(f.voicedRatio)}`}
            />
            <Group label="F0 slope" value={dec(f.f0Slope)} />
            <Group label="Pause regularity" value={dec(f.pauseRegularity)} />
            <Group label="Intensity envelope" value={dec(f.intensityEnvelope)} />
            <Group label="F0 mid→end Δ" value={dec(f.f0MidEndDelta)} />
          </div>
        )}
      </div>

      {/* Topic stickiness — the one neutral, non-coach-judged metric we
          surface pre-judgment. Comment first (the substance), composite
          second (the receipt). Both nullable; if neither exists, drop
          the section entirely (don't render a bare header). */}
      {(snippet.stickiness.comment || snippet.stickiness.composite != null) && (
        <div>
          <p className="text-sm font-semibold text-foreground">Topic stickiness</p>
          {snippet.stickiness.comment ? (
            <p className="mt-1.5 text-[14px] italic leading-relaxed text-foreground">
              {snippet.stickiness.comment}
            </p>
          ) : null}
          {snippet.stickiness.composite != null ? (
            <p className="mt-1 text-[14px] text-muted-foreground">
              composite {dec(snippet.stickiness.composite)}
            </p>
          ) : null}
        </div>
      )}

      {/* Post-publish coach note (§14 user-facing lane). Pre-judgment
          this block stays absent — the §5 promise is that the verdict
          is the coach's job, not the FE's. */}
      {snippet.coach ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
              Your coach
            </span>
            {snippet.coach.tag ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                {snippet.coach.tag === "strong" ? "Strong" : "To work on"}
              </span>
            ) : null}
          </div>
          {snippet.coach.note ? (
            <p className="mt-1 text-[15px] leading-relaxed text-foreground">
              {snippet.coach.note}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- primitives ------------------------------- */

/** Hero numeral — large Display value + Meta label. The two a non-expert
 *  reads at a glance (speed + pause ratio). */
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

/** Grouped metric row — Meta label left, Body value right. Used inside the
 *  Show-details collapse for the non-hero acoustic features. */
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
