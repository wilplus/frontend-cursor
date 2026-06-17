"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import { useBackDismiss } from "./useBackDismiss";
import {
  fetchBestPresentation,
  type BestPresentationResult,
  type BestPresentationSlide,
} from "@/services/api/bestPresentation";

/* -------------------------------------------------------------------------- */
/*  BestPresentationOverlay — the per-slide "ideal presentation" view (F2)    */
/*                                                                            */
/*  Shows the user their best CHALLENGE delivery of each slide, assembled     */
/*  across up to 4 explore takes. Replaces the audit as the arc deliverable.  */
/*                                                                            */
/*  Anatomy per slide:                                                         */
/*    - Slide visual (PDF page or B&W text-card fallback)                     */
/*    - Composed text — the BE's lightly-edited verbatim line                 */
/*    - Audio player (the actual take's audio window)                         */
/*    - Breakthrough badge when the slide follows a threat moment (challenge   */
/*      mindset clicked; threat details NEVER shown to the user)               */
/*    - Placeholder when no usable take exists for this slide (F5)            */
/*                                                                            */
/*  Fences:                                                                   */
/*    - Renders what the BE sends verbatim; no client-side text generation.   */
/*    - No scores, no verdicts, no threat-direction data.                     */
/*    - Empty slide → placeholder, not invented content.                      */
/* -------------------------------------------------------------------------- */

export default function BestPresentationOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<BestPresentationResult | null>(null);

  useEffect(() => {
    let active = true;
    void fetchBestPresentation(arcId).then((r) => {
      if (!active) return;
      setResult(r);
      setStatus(r ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[15px] font-semibold text-foreground">
          Your ideal presentation
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
          {status === "loading" ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : status === "error" || !result ? (
            <p className="py-12 text-center text-[15px] text-muted-foreground">
              Couldn&apos;t load your presentation. Try again in a moment.
            </p>
          ) : !result.ready ? (
            <NotReadyState progress={result.progress} />
          ) : result.slides.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-muted-foreground">
              No slide data found for this presentation.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                Your strongest delivery of each slide across{" "}
                {result.progress.takesDone} session
                {result.progress.takesDone !== 1 ? "s" : ""}, lightly stitched
                into continuous text. Study material — your best words, not a
                finished performance.
              </p>
              {result.slides.map((slide) => (
                <SlideCard
                  key={slide.index}
                  slide={slide}
                  presentationRef={result.presentationRef}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ primitives -------------------------------- */

function NotReadyState({
  progress,
}: {
  progress: { takesDone: number; takesTarget: number; takesRemaining: number };
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-[15px] text-foreground">
        we need {progress.takesRemaining} more{" "}
        {progress.takesRemaining === 1 ? "take" : "takes"} to generate your
        best lines
      </p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.round(
              (progress.takesDone / progress.takesTarget) * 100
            )}%`,
          }}
          role="progressbar"
          aria-valuenow={progress.takesDone}
          aria-valuemin={0}
          aria-valuemax={progress.takesTarget}
          aria-label="Sessions complete"
        />
      </div>
      <p className="text-[12px] text-muted-foreground">
        {progress.takesDone} of {progress.takesTarget} sessions complete
      </p>
    </div>
  );
}

function SlideCard({
  slide,
  presentationRef,
}: {
  slide: BestPresentationSlide;
  presentationRef: string | null;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const hasContent = slide.text.length > 0 || slide.audioRef !== null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      {/* Slide header */}
      <span className="text-[12px] text-muted-foreground">
        Slide {slide.index + 1}
      </span>

      {/* Breakthrough badge (F3) — tappable when a note is available */}
      {slide.breakthrough ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={
              slide.breakthroughNote ? () => setNoteOpen((v) => !v) : undefined
            }
            disabled={!slide.breakthroughNote}
            className="flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
            aria-expanded={slide.breakthroughNote ? noteOpen : undefined}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            You turned your stress into charisma.
          </button>
          {noteOpen && slide.breakthroughNote ? (
            <p className="pl-1 text-[12px] leading-snug text-muted-foreground">
              {slide.breakthroughNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Slide visual — PDF page when ref available, B&W text-card otherwise */}
      <SlideRender
        presentationRef={presentationRef}
        pageIndex={slide.index}
        title={slide.title}
        body=""
        className="w-full"
      />

      {/* Composed text + audio */}
      {hasContent ? (
        <>
          {slide.audioRef ? (
            <MediaPlayer src={slide.audioRef} startOffsetMs={0} durationMs={0} />
          ) : null}
          {slide.text ? (
            <p className="text-[15px] leading-relaxed text-foreground">
              {slide.text}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[14px] italic text-muted-foreground">
          No best recording for this slide yet.
        </p>
      )}
    </div>
  );
}
