"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
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

// Speed shows as a percentage of a 50-wpm reference (50 wpm = 100%), scaling
// proportionally and uncapped (100 wpm = 200%, 25 wpm = 50%). Product call — one
// intuitive "speed" number on the hero instead of raw words-per-minute (the raw
// wpm still lives in the Show-details panel).
const SPEED_REF_WPM = 50;
const speedPct = (wpm: number) => `${Math.round((wpm / SPEED_REF_WPM) * 100)}%`;

/** Gross speaking rate (words ÷ minutes) derived from a snippet's own
 *  transcript + duration — the fallback for the speed hero when the BE omits
 *  `speech_rate` from the instant readout. Words per minute including pauses
 *  (the textbook speaking-rate). null when there's nothing to divide, so the
 *  hero falls back to the dash. */
function grossWpm(transcript: string, durationMs: number): number | null {
  if (durationMs <= 0) return null;
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return null;
  return words / (durationMs / 60000);
}

export default function ReadoutCard({
  payload,
  isSample = false,
  onSend,
}: {
  payload: ReadoutPayload;
  isSample?: boolean;
  onSend?: () => void;
}) {
  const { snippets } = payload;
  const total = snippets.length;
  // One snippet at a time — Back / Next; the last snippet's Next becomes Send.
  const [cursor, setCursor] = useState(0);

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[15px] text-muted-foreground">
          No analyzable snippets in this recording.
        </p>
      </div>
    );
  }

  const idx = Math.min(cursor, total - 1);
  const atFirst = idx === 0;
  const atLast = idx === total - 1;

  return (
    <div className="flex flex-1 flex-col">
      {isSample && (
        <p className="mb-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
          Sample data — your real acoustic Training Profile wires in at seam ③.
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

      <SnippetCard
        snippet={snippets[idx]}
        index={idx}
        total={total}
        presentationRef={payload.presentationRef}
      />

      {/* Back (grey) + Next (orange). On the last snippet the Next becomes the
          send action when this is the pre-send Lab readout (onSend present);
          in the read-only insights view it just disables at the end. */}
      <div className="mt-5 flex items-stretch gap-3">
        <button
          type="button"
          onClick={() => setCursor((c) => Math.max(c - 1, 0))}
          disabled={atFirst}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-muted py-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        {atLast && onSend ? (
          <button
            type="button"
            onClick={onSend}
            className="flex flex-1 items-center justify-center rounded-full bg-primary px-3 py-4 text-center text-[15px] font-semibold leading-tight text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Send for a detailed analysis
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCursor((c) => Math.min(c + 1, total - 1))}
            disabled={atLast}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- snippet card ----------------------------- */

function SnippetCard({
  snippet,
  index,
  total,
  presentationRef,
}: {
  snippet: ReadoutSnippet;
  index: number;
  total: number;
  presentationRef: string | null;
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

      {/* Slide on screen during this snippet (deck attached) — the rendered
          PDF page or its text card, above the words; stickiness stays below. */}
      {snippet.slide ? (
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={snippet.slide.index}
          title={snippet.slide.title}
          body={snippet.slide.body}
          className="w-full"
        />
      ) : null}

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
          value={f.speechRate ?? grossWpm(snippet.transcript, snippet.durationMs)}
          label="speed"
          fmt={speedPct}
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
