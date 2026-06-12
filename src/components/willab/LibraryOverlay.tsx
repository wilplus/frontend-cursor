"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import {
  fetchStrengths,
  type StrengthMoment,
  type StrengthTraining,
  type StrengthsView,
} from "@/services/api/strengths";
import { SlideRender } from "./pdfSlides";
import SpeechDataPanel from "./SpeechDataPanel";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — your strong sides, slide-grouped (§7b redesign)            */
/*                                                                            */
/*  Four levels, back-arrow (top-left) only — no navbar title:                  */
/*    L1 Home      — a "Top delivery" reel card + a card per training + any      */
/*                   no-deck moments (grey landscape placeholder thumb).         */
/*    L2 Slides    — the training's deck: smaller slide cards.                   */
/*    L3 Slide     — the slide edge-to-edge (swipe / ‹ › + faint dots) and your  */
/*                   takes below (best one gets a "TOP" label).                  */
/*    L4 Take      — the slide, your line in orange, the coach's note, and a     │
/*                   toggle to the voice metrics (raw data).                     */
/*                                                                            */
/*  Data: GET /v2/user/strengths. The metrics toggle shows once the BE adds      */
/*  per-moment `features`; until then it's hidden. No-deck moments render with a  */
/*  placeholder where the slide would be.                                       */
/* -------------------------------------------------------------------------- */

const EMPTY: StrengthsView = { general: [], trainings: [] };

/** A swipeable slide-detail set: a training's all-takes, the top reel, or the
 *  general placeholder. */
type DeckSlide = { index: number; title: string; takes: StrengthMoment[] };
type Deck = {
  title: string;
  /** null → render the grey landscape placeholder for every slide image. */
  presentationRef: string | null;
  slides: DeckSlide[];
};

const trainingDeck = (t: StrengthTraining): Deck => ({
  title: t.topic || "Presentation",
  presentationRef: t.presentationRef,
  slides: t.slides.map((s) => ({ index: s.index, title: s.title, takes: s.moments })),
});

const reelDeck = (t: StrengthTraining): Deck => ({
  title: t.topic || "Your top delivery",
  presentationRef: t.presentationRef,
  slides: t.slides
    .filter((s) => s.moments.length > 0)
    .map((s) => ({ index: s.index, title: s.title, takes: [s.moments[0]] })),
});

const generalDeck = (moments: StrengthMoment[]): Deck => ({
  title: "General strengths",
  presentationRef: null,
  slides: [{ index: 0, title: "", takes: moments }],
});

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
  // Hardware / gesture back dismisses the whole overlay; the in-app arrow walks
  // the levels.
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [view, setView] = useState<StrengthsView>(EMPTY);

  // Navigation: slideList (L2) → deck + slideIdx (L3) → takeIdx (L4).
  const [slideList, setSlideList] = useState<StrengthTraining | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [takeIdx, setTakeIdx] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStrengths().then((v) => {
      if (!active) return;
      setView(v);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  function openDeck(d: Deck, idx = 0) {
    setDeck(d);
    setSlideIdx(Math.min(Math.max(idx, 0), Math.max(d.slides.length - 1, 0)));
    setTakeIdx(null);
  }
  function back() {
    if (deck && takeIdx != null) return setTakeIdx(null);
    if (deck) {
      setDeck(null);
      setSlideIdx(0);
      return;
    }
    if (slideList) return setSlideList(null);
    onClose();
  }

  const recent = view.trainings[0];
  const reel = recent ? reelDeck(recent) : null;
  const showReel = reel != null && reel.slides.length > 0;

  const curSlide = deck?.slides[slideIdx] ?? null;
  const curTake =
    deck && takeIdx != null ? deck.slides[slideIdx]?.takes[takeIdx] ?? null : null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* No navbar title — just the back arrow, top-left. */}
      <div className="flex h-12 shrink-0 items-center px-2">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : curTake && deck && curSlide ? (
          <TakeDetail
            presentationRef={deck.presentationRef}
            slideIndex={curSlide.index}
            take={curTake}
          />
        ) : deck ? (
          <SlideDetail
            deck={deck}
            slideIdx={slideIdx}
            onSlide={setSlideIdx}
            onOpenTake={setTakeIdx}
          />
        ) : slideList ? (
          <SlideListScreen
            training={slideList}
            onOpenSlide={(i) => openDeck(trainingDeck(slideList), i)}
          />
        ) : (
          <HomeScreen
            view={view}
            reel={showReel ? reel : null}
            recent={recent ?? null}
            onOpenReel={() => reel && openDeck(reel)}
            onOpenTraining={setSlideList}
            onOpenGeneral={() => openDeck(generalDeck(view.general))}
          />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────── L1 home ────────────────────────────── */

function HomeScreen({
  view,
  reel,
  recent,
  onOpenReel,
  onOpenTraining,
  onOpenGeneral,
}: {
  view: StrengthsView;
  reel: Deck | null;
  recent: StrengthTraining | null;
  onOpenReel: () => void;
  onOpenTraining: (t: StrengthTraining) => void;
  onOpenGeneral: () => void;
}) {
  const empty =
    view.trainings.length === 0 && view.general.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <h1 className="mb-4 text-[20px] font-semibold text-foreground">Strengths</h1>

      {empty ? (
        <p className="max-w-sm text-[15px] text-muted-foreground">
          Nothing here yet — your coach&apos;s notes on your strongest moments
          collect here as you get reads.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Top delivery — the whole presentation's best take per slide. */}
          {reel ? (
            <Card
              height={84}
              onClick={onOpenReel}
              top
              presentationRef={recent?.presentationRef ?? null}
              slideIndex={recent?.titleSlide?.index ?? 0}
              title="Your top delivery"
              eyebrow="TOP"
            />
          ) : null}

          {/* One card per training. */}
          {view.trainings.map((t) => (
            <Card
              key={t.sessionId}
              height={84}
              onClick={() => onOpenTraining(t)}
              presentationRef={t.presentationRef}
              slideIndex={t.titleSlide?.index ?? 0}
              title={t.topic || "Presentation"}
            />
          ))}

          {/* No-deck moments → placeholder thumbnail. */}
          {view.general.length > 0 ? (
            <Card
              height={84}
              onClick={onOpenGeneral}
              presentationRef={null}
              slideIndex={0}
              title="General strengths"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── L2 slide list ─────────────────────────── */

function SlideListScreen({
  training,
  onOpenSlide,
}: {
  training: StrengthTraining;
  onOpenSlide: (i: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <h1 className="mb-4 text-[20px] font-semibold text-foreground">
        {training.topic || "Presentation"}
      </h1>
      <div className="flex flex-col gap-2.5">
        {training.slides.map((s, i) => (
          <Card
            key={s.index}
            height={51}
            onClick={() => onOpenSlide(i)}
            presentationRef={training.presentationRef}
            slideIndex={s.index}
            title={s.title || `Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────── shared card + thumbnail ────────────────────── */

/** A horizontal rectangle card: slide thumbnail (left) + title. The training
 *  list uses height 84, the slide list 51. `top` tints it for the reel. */
function Card({
  height,
  onClick,
  presentationRef,
  slideIndex,
  title,
  eyebrow,
  top,
}: {
  height: number;
  onClick: () => void;
  presentationRef: string | null;
  slideIndex: number;
  title: string;
  eyebrow?: string;
  top?: boolean;
}) {
  // Thumbnail keeps a 16:9 slide aspect off the card height.
  const thumbW = Math.round((height * 16) / 9);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ height }}
      className={`flex w-full items-stretch overflow-hidden rounded-xl border text-left transition active:scale-[0.995] ${
        top
          ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.07]"
          : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <div className="shrink-0" style={{ width: thumbW }}>
        <Thumb presentationRef={presentationRef} slideIndex={slideIndex} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        {eyebrow ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </span>
        ) : null}
        <span className="truncate text-[15px] font-medium text-foreground">
          {title}
        </span>
      </div>
    </button>
  );
}

/** The slide rendered (PDF page), or a grey landscape placeholder when no deck
 *  was uploaded. */
function Thumb({
  presentationRef,
  slideIndex,
}: {
  presentationRef: string | null;
  slideIndex: number;
}) {
  if (!presentationRef) return <SlidePlaceholder className="h-full w-full" />;
  return (
    <div className="h-full w-full overflow-hidden bg-muted">
      <SlideRender
        presentationRef={presentationRef}
        pageIndex={slideIndex}
        title=""
        body=""
        className="h-full w-full"
      />
    </div>
  );
}

function SlidePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-muted ${className ?? ""}`}
      aria-label="No slide uploaded"
    >
      <ImageIcon className="h-7 w-7 text-muted-foreground/40" aria-hidden />
    </div>
  );
}

/* ─────────────────────────── L3 slide detail ─────────────────────────── */

function SlideDetail({
  deck,
  slideIdx,
  onSlide,
  onOpenTake,
}: {
  deck: Deck;
  slideIdx: number;
  onSlide: (i: number) => void;
  onOpenTake: (i: number) => void;
}) {
  const total = deck.slides.length;
  const slide = deck.slides[slideIdx];
  const touchX = useRef<number | null>(null);
  const go = (dir: -1 | 1) =>
    onSlide(Math.min(Math.max(slideIdx + dir, 0), total - 1));

  if (!slide) return null;

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* Slide, edge-to-edge, with faint position dots + ‹ › overlaid. Swipe to
          move between slides. */}
      <div
        className="relative w-full select-none"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="aspect-video w-full bg-muted">
          {deck.presentationRef ? (
            <SlideRender
              presentationRef={deck.presentationRef}
              pageIndex={slide.index}
              title={slide.title}
              body=""
              className="h-full w-full"
            />
          ) : (
            <SlidePlaceholder className="h-full w-full" />
          )}
        </div>

        {slideIdx > 0 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {slideIdx < total - 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        {total > 1 ? (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {deck.slides.map((s, i) => (
              <span
                key={s.index}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === slideIdx ? "bg-white/90" : "bg-white/30"
                }`}
                aria-hidden
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Takes on this slide — best first (the best gets a TOP label). */}
      <div className="flex flex-col gap-3 px-4 pt-5">
        {slide.takes.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No standout moment here yet — worth another run.
          </p>
        ) : (
          slide.takes.map((t, i) => (
            <TakeRow
              key={i}
              take={t}
              isTop={i === 0}
              onClick={() => onOpenTake(i)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TakeRow({
  take,
  isTop,
  onClick,
}: {
  take: StrengthMoment;
  isTop: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/50 active:scale-[0.995]"
    >
      {isTop ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Top
        </span>
      ) : null}
      <p
        className={`text-[15px] leading-snug text-foreground ${isTop ? "mt-1" : ""}`}
      >
        {take.transcript}
      </p>
    </button>
  );
}

/* ─────────────────────────── L4 take detail ─────────────────────────── */

function TakeDetail({
  presentationRef,
  slideIndex,
  take,
}: {
  presentationRef: string | null;
  slideIndex: number;
  take: StrengthMoment;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      <div className="aspect-video w-full bg-muted">
        {presentationRef ? (
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slideIndex}
            title=""
            body=""
            className="h-full w-full"
          />
        ) : (
          <SlidePlaceholder className="h-full w-full" />
        )}
      </div>

      <div className="flex flex-col gap-5 px-4 pt-6">
        {/* Your line — marked orange. */}
        <p className="text-[17px] font-medium leading-relaxed text-primary">
          {take.transcript}
        </p>

        {/* The coach's note — same font, not orange. */}
        {take.note ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {take.note}
          </p>
        ) : null}

        {/* The mathematics behind it — raw acoustic data (shows once the BE
            includes per-moment features). */}
        {take.features ? (
          <SpeechDataPanel features={take.features} label="The mathematics behind it" />
        ) : null}
      </div>
    </div>
  );
}
