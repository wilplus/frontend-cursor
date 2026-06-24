"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlideRender } from "./pdfSlides";
import { type PresentationSlide } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  SlideStage — the deck shown WHILE recording (T7)                            */
/*                                                                            */
/*  The user advances slides while they speak — manual, like a real            */
/*  presentation; nothing is voice-driven. Big symmetric controls below the     */
/*  slide: orange Next (right) + grey Back (left); tapping the slide itself      */
/*  also advances (clicker feel). Renders the BE PDF page (presentationRef) or  */
/*  a text card. The parent owns `current` + captures the tap timeline.         */
/* -------------------------------------------------------------------------- */

export default function SlideStage({
  slides,
  presentationRef,
  current,
  onNext,
  onPrev,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  current: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const total = slides.length;
  if (total === 0) return null;
  const idx = Math.min(Math.max(current, 0), total - 1);
  const slide = slides[idx];
  const atFirst = idx === 0;
  const atLast = idx === total - 1;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* The slide — rendered exactly like the after-recording views: edge-to-
          edge `w-full bg-muted`, natural height (no border card, no aspect-video
          letterboxing). Tapping it also advances (clicker feel); the buttons
          below are the primary control. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onNext}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onNext();
          }
        }}
        aria-label="Next slide"
        className="w-full cursor-pointer bg-muted"
      >
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={idx}
          title={slide.title}
          body={slide.body}
          className="w-full"
        />
      </div>

      <p className="text-center text-[12px] tabular-nums text-muted-foreground">
        Slide {idx + 1} of {total}
      </p>

      {/* Big symmetric nav: grey Back (left) + orange Next (right). */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={atFirst}
          aria-label="Previous slide"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-muted py-4 text-[16px] font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={atLast}
          aria-label="Next slide"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
