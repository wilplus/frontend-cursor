"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import {
  canBubble,
  IDLE_WHEEL_GESTURE,
  scrollEdge,
  wheelGestureStep,
  type WheelGestureState,
} from "@/lib/willab/deckScroll";
import type { PresentationSlide } from "./presentation";
import SlideStage from "./SlideStage";

export interface RecordingRoot {
  slideIndex: number;
  text: string;
  type: "flagship" | "neutral";
}

/**
 * The canonical manual rehearsal navigator.
 *
 * The slide stays visible while its ordered roots move in one native scroller.
 * At an edge, the same gesture contract as Ideal Text advances exactly one
 * slide and absorbs the momentum tail. Nothing here follows audio.
 */
export default function RecordingRoadmap({
  slides,
  presentationRef,
  currentSlide,
  roots,
  onSlideChange,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  currentSlide: number;
  roots: RecordingRoot[];
  onSlideChange: (slideIndex: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wheelGestureRef = useRef<WheelGestureState>(IDLE_WHEEL_GESTURE);
  const touchRef = useRef<{ y: number; consumed: boolean } | null>(null);
  const currentSlideRef = useRef(currentSlide);
  const directionRef = useRef<1 | -1>(1);
  const onSlideChangeRef = useRef(onSlideChange);
  /** The speaker has moved to another slide once (founder 2026-09-26): the
   *  hint has done its job and goes for the rest of the take. */
  const [movedOnce, setMovedOnce] = useState(false);

  const currentRoots = useMemo(
    () => roots.filter((root) => root.slideIndex === currentSlide),
    [currentSlide, roots]
  );

  useEffect(() => {
    currentSlideRef.current = currentSlide;
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop =
      directionRef.current === -1
        ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        : 0;
  }, [currentRoots.length, currentSlide]);

  useEffect(() => {
    onSlideChangeRef.current = onSlideChange;
  }, [onSlideChange]);

  const goToSlide = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), slides.length - 1);
      if (slides.length === 0 || next === currentSlideRef.current) return;
      directionRef.current = next < currentSlideRef.current ? -1 : 1;
      currentSlideRef.current = next;
      setMovedOnce(true);
      onSlideChangeRef.current(next);
    },
    [slides.length]
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? stage.clientHeight
            : 1;
      const deltaY = event.deltaY * unit;
      if (deltaY === 0) return;

      event.preventDefault();
      const direction: 1 | -1 = deltaY > 0 ? 1 : -1;
      const scroller = scrollRef.current;
      const edge = scroller ? scrollEdge(scroller) : "both";
      const outcome = wheelGestureStep(wheelGestureRef.current, {
        deltaY,
        now: performance.now(),
        innerCanScroll: !canBubble(edge, direction),
      });
      wheelGestureRef.current = outcome.state;

      if (outcome.action === "scroll-inner" && scroller) {
        scroller.scrollTop += deltaY;
        return;
      }
      if (outcome.action === "advance-screen") {
        goToSlide(currentSlideRef.current + direction);
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [goToSlide]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onStart = (event: TouchEvent) => {
      touchRef.current = {
        y: event.touches[0]?.clientY ?? 0,
        consumed: false,
      };
    };
    const onMove = (event: TouchEvent) => {
      const touch = touchRef.current;
      if (!touch || touch.consumed) return;
      const deltaY = touch.y - (event.touches[0]?.clientY ?? touch.y);
      if (Math.abs(deltaY) < 48) return;
      const direction: 1 | -1 = deltaY > 0 ? 1 : -1;
      const scroller = scrollRef.current;
      const edge = scroller ? scrollEdge(scroller) : "both";
      if (!canBubble(edge, direction)) return;
      touch.consumed = true;
      goToSlide(currentSlideRef.current + direction);
    };
    const onEnd = () => {
      touchRef.current = null;
    };

    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: true });
    stage.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
    };
  }, [goToSlide]);

  // First take: no Ideal Text yet, so no anchors fill the space under the
  // slide. Show how to move on instead — ANIMATED, and only until the first
  // move (founder 2026-09-26: "an animation that shows you to scroll … after
  // the first scroll it should disappear, just a guide for first time
  // users").
  const showNextHint =
    roots.length === 0 && currentSlide < slides.length - 1 && !movedOnce;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const direction: 1 | -1 =
      event.key === "ArrowUp" || event.key === "PageUp" ? -1 : 1;
    if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const edge = scrollEdge(scroller);
    if (canBubble(edge, direction)) {
      goToSlide(currentSlideRef.current + direction);
      return;
    }
    scroller.scrollTop +=
      direction *
      scroller.clientHeight *
      (event.key.startsWith("Page") ? 0.8 : 0.25);
  }

  return (
    <div ref={stageRef} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <SlideStage
          slides={slides}
          presentationRef={presentationRef}
          current={currentSlide}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="scrollbar-none h-full overflow-y-auto overscroll-contain pr-9 outline-none"
          aria-label={`Speaking anchors for slide ${currentSlide + 1}`}
        >
          <div className="flex min-h-full flex-col justify-center py-6">
            {showNextHint ? (
              <NextSlideHint
                onPrev={
                  currentSlide > 0
                    ? () => goToSlide(currentSlide - 1)
                    : undefined
                }
                onNext={() => goToSlide(currentSlide + 1)}
              />
            ) : null}
            {currentRoots.map((root, rootIndex) => (
              <p
                key={`${rootIndex}-${root.text}`}
                className={`${rootIndex === 0 ? "" : "mt-6"} text-[clamp(1.4rem,4.2vw,1.9rem)] leading-[1.35] ${
                  root.type === "flagship"
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-foreground"
                }`}
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
                      ? "h-6 w-1.5 rounded-full bg-foreground transition-[height]"
                      : "h-1.5 w-1.5 rounded-full bg-muted-foreground/35 transition-[height] hover:bg-muted-foreground"
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

/** Faint "go to the next slide" hint for the empty first-take space.
 *  Touch screens get "Scroll down" with a large arrow (tap = next slide);
 *  mouse/trackpad screens get the arrow-key cluster with the down key
 *  outlined in orange. There the up key goes to the previous slide and the
 *  down key to the next, like the keyboard's own arrows. Chosen by CSS
 *  pointer media so the server render matches the client. */
function NextSlideHint({
  onPrev,
  onNext,
}: {
  /** Absent on the first slide, where there is nothing before it. */
  onPrev?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center self-center text-foreground opacity-50">
      <button
        type="button"
        onClick={onNext}
        aria-label="Next slide"
        className="hidden flex-col items-center gap-2 transition-opacity hover:opacity-70 [@media(pointer:coarse)]:flex"
      >
        <span className="text-[clamp(1.6rem,6vw,2.2rem)] font-semibold leading-tight">
          Scroll down
        </span>
        <ChevronDown
          className="h-10 w-10 motion-safe:animate-bounce"
          aria-hidden
        />
      </button>
      <div className="flex flex-col items-center gap-4 [@media(pointer:coarse)]:hidden">
        <div className="grid grid-cols-3 gap-1.5">
          <span />
          <ArrowKey
            icon={ChevronUp}
            onClick={onPrev}
            label="Previous slide"
          />
          <span />
          <ArrowKey icon={ChevronLeft} />
          <ArrowKey
            icon={ChevronDown}
            active
            pulse
            onClick={onNext}
            label="Next slide"
          />
          <ArrowKey icon={ChevronRight} />
        </div>
        <span className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight">
          Click down
        </span>
      </div>
    </div>
  );
}

/** One key of the drawn arrow cluster. With `onClick` it is a real button;
 *  without, it is only a picture of a key. */
function ArrowKey({
  icon: Icon,
  active = false,
  pulse = false,
  onClick,
  label,
}: {
  icon: LucideIcon;
  active?: boolean;
  /** The key to press, drawn moving (motion-safe) so the eye finds it. */
  pulse?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const className = `flex h-11 w-11 items-center justify-center rounded-lg border-2 ${
    active
      ? "border-primary text-primary"
      : "border-muted-foreground/40 text-muted-foreground"
  }${pulse ? " motion-safe:animate-bounce" : ""}`;
  if (!onClick) {
    return (
      <span className={className} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${className} transition-colors hover:bg-muted`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
