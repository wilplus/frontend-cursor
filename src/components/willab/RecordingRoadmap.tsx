"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { ENTER_OFFSET_PX, type Dir } from "@/lib/willab/recordingGesture";
import type { PresentationSlide } from "./presentation";
import SlideStage from "./SlideStage";
import FinishTakeButton from "./FinishTakeButton";
import { RECORDING_COPY } from "./recordingCopy";
import { useRecordingGestures } from "./useRecordingGestures";

export interface RecordingRoot {
  slideIndex: number;
  text: string;
  type: "flagship" | "neutral";
}

/**
 * The canonical manual rehearsal navigator (founder lock 2026-10-12, the
 * recording screens, N70).
 *
 * BUTTONS, NOT SCROLLING. Back and Next slide sit under the strip; on the
 * last slide Next slide becomes the red Finish take, the only way a Take
 * ends from here. ← → change the slide too (N70.1). No slide dots.
 *
 * ONLY THE SLIDE AND ITS HELPER WORDS MOVE, sideways: Next sends them out to
 * the left and lands the next ones from the right; Back the reverse. The top
 * bar, the strip and the buttons are not touched by a move. Every slide
 * change reaches the overlay's setter, which timestamps it into the timeline
 * the backend buckets words with. Nothing here follows audio.
 */
export default function RecordingRoadmap({
  slides,
  presentationRef,
  currentSlide,
  roots,
  onSlideChange,
  strip,
  onFinish,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  roots: RecordingRoot[];
  onSlideChange: (slideIndex: number) => void;
  /** The clock and its bar, drawn above the buttons. */
  strip: ReactNode;
  onFinish: () => void;
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

  // A slide arriving forward opens at the top of its words; one arriving
  // back opens at their end, where the speaker left that way.
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
      return stage ? Math.round(stage.clientWidth * 0.35) || 160 : 160;
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
    enter(ENTER_OFFSET_PX);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = currentSlide >= slides.length - 1;

  return (
    <>
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
          className="scrollbar-none h-full overflow-y-auto overscroll-contain outline-none will-change-transform"
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

      </div>
    </div>

      <div
        data-testid="recording-strip"
        className="relative z-10 -mx-1 shrink-0 bg-background px-1 pt-4 pb-[env(safe-area-inset-bottom)]"
      >
        {strip}
        {/* The coach panel's pair: equal halves, 48px, 16px corners. */}
        <div className="mt-2.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => goToSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-border bg-background text-[15px] font-semibold text-foreground disabled:opacity-35"
          >
            {RECORDING_COPY.back}
          </button>
          {last ? (
            <FinishTakeButton onClick={onFinish} className="h-12 flex-1 rounded-2xl text-[15px]" />
          ) : (
            <button
              type="button"
              onClick={() => goToSlide(currentSlide + 1)}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-foreground text-[15px] font-semibold text-background"
            >
              {RECORDING_COPY.nextSlide}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
