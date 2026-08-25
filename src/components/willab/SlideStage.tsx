"use client";

import { SlideRender } from "./pdfSlides";
import { type PresentationSlide } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  SlideStage — the deck shown WHILE recording (T7)                            */
/*                                                                            */
/*  The slide is selected by manual scrolling through its speaking anchors;    */
/*  nothing is voice-driven and the preview itself is not another control.     */
/*                                                                            */
/*  THE SLIDE IS THE SLIDE (founder 2026-08-11). Whatever the speaker          */
/*  uploaded renders here — SlideRender draws the deck's own PDF page          */
/*  whenever `presentationRef` is set, and only falls back to the text card    */
/*  for the default deck (or a PDF that refused to load). This slot is never   */
/*  hardcoded to text.                                                        */
/*                                                                            */
/*  Slide position now lives in RecordingRoadmap's right rail, so this         */
/*  component has one job: render the real page (or canonical default slide). */
/* -------------------------------------------------------------------------- */

export default function SlideStage({
  slides,
  presentationRef,
  current,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  current: number;
}) {
  const total = slides.length;
  if (total === 0) return null;
  const idx = Math.min(Math.max(current, 0), total - 1);
  const slide = slides[idx];

  return (
    <div className="flex w-full justify-center">
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-card">
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={idx}
          title={slide.title}
          body={slide.body}
          artworkSrc={slide.artworkSrc}
          className="h-full w-full"
          fit
          showRetry={false}
        />
      </div>
    </div>
  );
}
