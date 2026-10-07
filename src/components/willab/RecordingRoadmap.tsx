"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { ENTER_OFFSET_PX, type Dir } from "@/lib/willab/recordingGesture";
import type { PresentationSlide } from "./presentation";
import SlideStage from "./SlideStage";
import { useRecordingGestures } from "./useRecordingGestures";

export interface RecordingRoot {
  slideIndex: number;
  text: string;
  type: "flagship" | "neutral";
}

/**
 * The canonical manual rehearsal navigator (founder lock 2026-10-07, the
 * recording screens).
 *
 * ONLY THE SLIDE AND ITS HELPER WORDS MOVE. A slide change glides those two
 * out, swaps them in place and lands them from the other side; the slide dots
 * stay where they are and only change which one is current. The top bar and
 * the strip live outside this component and are not touched by a move.
 *
 * The helper words scroll first: when they are longer than the space, the
 * gesture scrolls them, and at their edge it moves the slide. Every slide
 * change still reaches the overlay's setter, which timestamps it into the
 * timeline the backend buckets words with. Nothing here follows audio.
 */
export default function RecordingRoadmap({
  slides,
  presentationRef,
  currentSlide,
  roots,
  onSlideChange,
  entrance = "mic",
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  roots: RecordingRoot[];
  onSlideChange: (slideIndex: number) => void;
  /** How the screen arrives: from "Getting your mic ready" it glides in
   *  softly; from the learning screen it lands from below, as the next
   *  screen of the same move. */
  entrance?: "mic" | "learn";
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slideBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentSlideRef = useRef(currentSlide);
  const directionRef = useRef<Dir>(1);
  const onSlideChangeRef = useRef(onSlideChange);
  currentSlideRef.current = currentSlide;
  onSlideChangeRef.current = onSlideChange;

  const currentRoots = useMemo(
    () => roots.filter((root) => root.slideIndex === currentSlide),
    [currentSlide, roots]
  );

  // A slide arriving from below opens at the top of its words; one arriving
  // from above opens at their end, where the speaker left that way.
  // Layout, not passive: it must hold before the landing paints.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop =
      directionRef.current === -1
        ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        : 0;
  }, [currentRoots.length, currentSlide]);

  const canGo = useCallback(
    (dir: Dir) => {
      const next = currentSlideRef.current + dir;
      return next >= 0 && next < slides.length;
    },
    [slides.length]
  );

  const { glide, enter } = useRecordingGestures({
    root: () => stageRef.current,
    moving: () =>
      [slideBoxRef.current, scrollRef.current].filter(
        (el): el is HTMLDivElement => el !== null
      ),
    scroller: () => scrollRef.current,
    travel: () => {
      const stage = stageRef.current;
      return stage ? Math.round(stage.clientHeight * 0.3) || 160 : 160;
    },
    canGo,
    go: (dir) => goToSlide(currentSlideRef.current + dir),
  });

  const goToSlide = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), slides.length - 1);
      if (slides.length === 0 || next === currentSlideRef.current) return;
      const dir: Dir = next < currentSlideRef.current ? -1 : 1;
      glide(dir, () => {
        directionRef.current = dir;
        currentSlideRef.current = next;
        onSlideChangeRef.current(next);
      });
    },
    [glide, slides.length]
  );

  // The entrance, once: the content lands; the frame around it is already
  // still.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    enter(
      entrance === "learn" && stage
        ? Math.round(stage.clientHeight * 0.3) || 160
        : ENTER_OFFSET_PX
    );
    // Mount only: a later change of `entrance` is not a new arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={stageRef} className="flex min-h-0 flex-1 flex-col">
      <div ref={slideBoxRef} className="shrink-0 pb-4 will-change-transform">
        <SlideStage
          slides={slides}
          presentationRef={presentationRef}
          current={currentSlide}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="scrollbar-none h-full overflow-y-auto overscroll-contain pr-9 outline-none will-change-transform"
          aria-label={`Speaking anchors for slide ${currentSlide + 1}`}
        >
          <div className="flex min-h-full flex-col justify-center py-6">
            {/* NO KICKER over the cues (founder 2026-09-29: "no need for the
                little title 'helper words'"); the orange words are the
                helper words, and the picker already named them. */}
            {currentRoots.map((root, rootIndex) => (
              <p
                key={`${rootIndex}-${root.text}`}
                // Every helper word is orange, neutral ones too (founder
                // 2026-10-07: "make them orange!").
                className={`${rootIndex === 0 ? "" : "mt-6"} text-[clamp(1.4rem,4.2vw,1.9rem)] font-semibold leading-[1.35] text-primary`}
              >
                {root.text}
              </p>
            ))}
          </div>
        </div>

        {slides.length > 1 ? (
          <nav
            className="absolute inset-y-0 right-0 flex flex-col items-center justify-center"
            aria-label="Presentation slide position"
          >
            {slides.map((slide, index) => (
              <button
                key={`rail-${index}-${slide.title}`}
                type="button"
                aria-label={`Go to slide ${index + 1} of ${slides.length}`}
                aria-current={currentSlide === index ? "step" : undefined}
                onClick={() => goToSlide(index)}
                className="flex h-8 w-8 items-center justify-center"
              >
                <span
                  className={
                    currentSlide === index
                      ? "h-6 w-1.5 rounded-full bg-foreground transition-[height] duration-200"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/35 transition-[height] duration-200"
                  }
                  aria-hidden
                />
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
