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
/*  Anatomy mirrors AuditInsights's post-publish snippet card so the user      */
/*  reads the same shape at both lifecycle stages — only the lens shifts.      */
/*  Two sections:                                                              */
/*    • What — audio + transcript (italic, orange-bordered).                   */
/*    • Topic stickiness — the ONE neutral metric we surface pre-judgment      */
/*      (comment first, composite second). Acoustic features (pitch, pace,    */
/*      volume) are deliberately not shown here — without a baseline they      */
/*      read as "is this good or bad?", and §5's whole point is to hand        */
/*      that interpretation to the coach. The post-publish Insights view      */
/*      adds those metrics back under a "Why" section authored alongside       */
/*      the human note.                                                        */
/*                                                                            */
/*  Reused by the coach-authoring view (§14): the optional `snippet.coach`     */
/*  block at the bottom renders when a coach note has been attached, so the    */
/*  same card carries the authoring lens with no structural divergence.       */
/* -------------------------------------------------------------------------- */

const DASH = "—";
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
