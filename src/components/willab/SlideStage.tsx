"use client";

import { ChevronLeft } from "lucide-react";
import { SlideRender } from "./pdfSlides";
import { type PresentationSlide } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  SlideStage — the deck shown WHILE recording (T7)                            */
/*                                                                            */
/*  The user taps to advance while they speak — manual, like a real            */
/*  presentation; nothing is voice-driven. Tap the stage = next; the Back       */
/*  chevron = prev. Renders the BE PDF page (presentationRef) or a text card.   */
/*  The parent owns `current` + captures the tap timeline (slide_advances).     */
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

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Tap anywhere on the stage to advance, like a clicker. */}
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
        className="w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-muted/30 p-2"
      >
        <div className="aspect-video w-full">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={idx}
            title={slide.title}
            body={slide.body}
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={idx === 0}
          aria-label="Previous slide"
          className="flex items-center gap-1 text-[13px] text-muted-foreground enabled:hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {idx + 1} / {total}
        </span>
        <span className="text-[12px] text-muted-foreground">Tap to advance</span>
      </div>
    </div>
  );
}
