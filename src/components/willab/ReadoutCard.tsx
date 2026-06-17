"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlideRender } from "./pdfSlides";
import SnippetReadoutBlock from "./SnippetReadoutBlock";
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
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <span className="text-[12px] text-muted-foreground">
        Snippet {index + 1} of {total}
      </span>

      {/* Slide on screen during this snippet (deck attached) */}
      {snippet.slide ? (
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={snippet.slide.index}
          title={snippet.slide.title}
          body={snippet.slide.body}
          className="w-full"
        />
      ) : null}

      <SnippetReadoutBlock
        audioRef={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
        transcript={snippet.transcript}
        stickiness={snippet.stickiness}
        features={snippet.features}
      />

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

