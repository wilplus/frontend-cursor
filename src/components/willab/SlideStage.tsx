"use client";

import { SlideRender } from "./pdfSlides";
import { type PresentationSlide } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  SlideStage — the deck shown WHILE recording (T7)                            */
/*                                                                            */
/*  The user advances slides while they speak — manual, like a real            */
/*  presentation; nothing is voice-driven. Tapping the slide advances          */
/*  (clicker feel); the dock's buttons are the primary control.                */
/*                                                                            */
/*  THE SLIDE IS THE SLIDE (founder 2026-08-11). Whatever the speaker          */
/*  uploaded renders here — SlideRender draws the deck's own PDF page          */
/*  whenever `presentationRef` is set, and only falls back to the text card    */
/*  for the default deck (or a PDF that refused to load). This slot is never   */
/*  hardcoded to text.                                                        */
/*                                                                            */
/*  The nav USED to live here as two equal-weight pills under the slide. It    */
/*  moved into the recording dock (founder 2026-08-11, respec §3): Next is     */
/*  the one control you reach for mid-sentence, so it is a full-width primary  */
/*  pill pinned to the bottom of the screen with Back reduced to a circular    */
/*  icon beside it — not a twin competing for the same glance.                 */
/* -------------------------------------------------------------------------- */

export default function SlideStage({
  slides,
  presentationRef,
  current,
  onNext,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  current: number;
  onNext: () => void;
}) {
  const total = slides.length;
  if (total === 0) return null;
  const idx = Math.min(Math.max(current, 0), total - 1);
  const slide = slides[idx];

  return (
    <div className="flex w-full flex-col gap-4">
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
        className="aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card"
      >
        <SlideRender
          presentationRef={presentationRef}
          pageIndex={idx}
          title={slide.title}
          body={slide.body}
          className="h-full w-full"
          fit
          showRetry={false}
        />
      </div>

      {/* Progress as DOTS, not a sentence (respec §5). The active dot widens
          rather than changing colour alone, so the position reads at a glance
          from across a room — you are looking at this while speaking. The
          count stays beside it for anyone who wants the number; it is a
          position, never a score (AC-9). */}
      <div className="flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <span
              key={`${i}-${s.title.slice(0, 8)}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {idx + 1} / {total}
        </span>
      </div>
    </div>
  );
}
