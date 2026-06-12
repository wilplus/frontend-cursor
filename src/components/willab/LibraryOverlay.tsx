"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchStrengths,
  strengthsHome,
  type BestLines,
  type StrengthMoment,
  type StrengthTraining,
  type StrengthsView,
  type TakeCard,
} from "@/services/api/strengths";
import type { ReadoutFeatures } from "./readout";
import { SlideRender } from "./pdfSlides";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — "Trainings" (§ unification, phase 1)                      */
/*                                                                            */
/*  Home → slide list → slide take. Breadcrumb (Training / My app, take 3 /     */
/*  Slide 1) is the nav — no back arrow. The slide "take" is the shared piece    */
/*  (picture → Take N → inline playback → text → Advise ▾ → Data ▾, swipe);      */
/*  phase 2 reuses it for Coach Insights with a different top bar.              */
/* -------------------------------------------------------------------------- */

const EMPTY: StrengthsView = { general: [], trainings: [] };

type DeckSlide = {
  index: number;
  title: string;
  body: string;
  moment: StrengthMoment | null;
};
type Deck = {
  topic: string;
  takeLabel: string; // "take 3" | "best takes" | "general"
  takeTitle: string; // bold in-slide title: "Take 3" | "Best take" | ""
  presentationRef: string | null;
  slides: DeckSlide[];
};

const takeDeck = (c: TakeCard): Deck => ({
  topic: c.training.topic || "Presentation",
  takeLabel: `take ${c.takeNumber}`,
  takeTitle: `Take ${c.takeNumber}`,
  presentationRef: c.training.presentationRef,
  slides: c.training.slides.map((s) => ({
    index: s.index,
    title: s.title,
    body: s.body,
    moment: s.moments[0] ?? null,
  })),
});
const bestDeck = (b: BestLines): Deck => ({
  topic: b.topic,
  takeLabel: "best takes",
  takeTitle: "Best take",
  presentationRef: b.presentationRef,
  slides: b.slides.map((s) => ({
    index: s.index,
    title: s.title,
    body: s.body,
    moment: s.moment,
  })),
});
const generalDeck = (moments: StrengthMoment[]): Deck => ({
  topic: "General strengths",
  takeLabel: "general",
  takeTitle: "",
  presentationRef: null,
  slides: moments.map((m, i) => ({ index: i, title: "", body: "", moment: m })),
});

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [view, setView] = useState<StrengthsView>(EMPTY);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIdx, setSlideIdx] = useState<number | null>(null); // null = slide list

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

  const home = useMemo(() => strengthsHome(view), [view]);
  const isEmpty =
    !home.bestLines && home.takes.length === 0 && home.general.length === 0;

  const goHome = () => {
    setDeck(null);
    setSlideIdx(null);
  };
  const goList = () => setSlideIdx(null);

  // Breadcrumb segments (the nav). Root closes nothing — the X closes the overlay.
  const crumbs: { label: string; onClick?: () => void }[] = deck
    ? slideIdx != null
      ? [
          { label: "Training", onClick: goHome },
          { label: `${deck.topic}, ${deck.takeLabel}`, onClick: goList },
          { label: `Slide ${slideIdx + 1}` },
        ]
      : [
          { label: "Training", onClick: goHome },
          { label: `${deck.topic}, ${deck.takeLabel}` },
        ]
    : [{ label: "Trainings" }];

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <nav className="flex min-w-0 items-center gap-1.5 text-[15px]">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground">/</span> : null}
              {c.onClick ? (
                <button
                  type="button"
                  onClick={c.onClick}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {c.label}
                </button>
              ) : (
                <span className="truncate font-semibold text-foreground">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-3 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deck && slideIdx != null ? (
          <SlideTake
            deck={deck}
            slideIdx={slideIdx}
            onSlideIdx={setSlideIdx}
          />
        ) : deck ? (
          <SlideList
            deck={deck}
            onOpenSlide={(i) => setSlideIdx(i)}
          />
        ) : isEmpty ? (
          <p className="mx-auto w-full max-w-2xl px-4 text-[15px] text-muted-foreground">
            Nothing here yet — your strongest moments collect here as your coach
            sends reads.
          </p>
        ) : (
          <Home
            home={home}
            onOpenBest={() => home.bestLines && setDeck(bestDeck(home.bestLines))}
            onOpenTake={(c) => setDeck(takeDeck(c))}
            onOpenGeneral={() => setDeck(generalDeck(home.general))}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── L1 home ─────────────────────────────── */

function Home({
  home,
  onOpenBest,
  onOpenTake,
  onOpenGeneral,
}: {
  home: ReturnType<typeof strengthsHome>;
  onOpenBest: () => void;
  onOpenTake: (c: TakeCard) => void;
  onOpenGeneral: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10">
      {home.bestLines ? (
        <Card
          height={84}
          top
          onClick={onOpenBest}
          presentationRef={home.bestLines.presentationRef}
          slideIndex={home.bestLines.slides[0]?.index ?? 0}
          title="These are your best lines ready to use on your next presentation"
        />
      ) : null}

      {home.takes.map((c) => (
        <Card
          key={c.training.sessionId}
          height={84}
          onClick={() => onOpenTake(c)}
          presentationRef={c.training.presentationRef}
          slideIndex={c.training.titleSlide?.index ?? 0}
          title={c.label}
        />
      ))}

      {home.general.length > 0 ? (
        <Card
          height={84}
          onClick={onOpenGeneral}
          presentationRef={null}
          slideIndex={0}
          title="General strengths"
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── L2 slides ───────────────────────────── */

function SlideList({
  deck,
  onOpenSlide,
}: {
  deck: Deck;
  onOpenSlide: (i: number) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-4 pb-10">
      {deck.slides.map((s, i) => (
        <Card
          key={`${s.index}-${i}`}
          height={51}
          onClick={() => onOpenSlide(i)}
          presentationRef={deck.presentationRef}
          slideIndex={s.index}
          title={s.title || `Slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ─────────────────────── card + thumbnail (shared) ─────────────────────── */

function Card({
  height,
  onClick,
  presentationRef,
  slideIndex,
  title,
  top,
}: {
  height: number;
  onClick: () => void;
  presentationRef: string | null;
  slideIndex: number;
  title: string;
  top?: boolean;
}) {
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
      <div className="flex min-w-0 flex-1 items-center px-4">
        <span className="line-clamp-2 text-[15px] font-medium text-foreground">
          {title}
        </span>
      </div>
    </button>
  );
}

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

/* ───────────────────── L3 slide take (the shared piece) ──────────────────── */

function SlideTake({
  deck,
  slideIdx,
  onSlideIdx,
}: {
  deck: Deck;
  slideIdx: number;
  onSlideIdx: (i: number) => void;
}) {
  const total = deck.slides.length;
  const slide = deck.slides[slideIdx];
  const touchX = useRef<number | null>(null);
  const go = (dir: -1 | 1) =>
    onSlideIdx(Math.min(Math.max(slideIdx + dir, 0), total - 1));

  if (!slide) return null;
  const m = slide.moment;

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* slide, edge-to-edge, swipe + ‹ › + faint dots */}
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
          <NavBtn side="left" onClick={() => go(-1)} />
        ) : null}
        {slideIdx < total - 1 ? (
          <NavBtn side="right" onClick={() => go(1)} />
        ) : null}
        {total > 1 ? (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {deck.slides.map((s, i) => (
              <span
                key={`${s.index}-${i}`}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === slideIdx ? "bg-white/90" : "bg-white/30"
                }`}
                aria-hidden
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 px-4 pt-4">
        {m ? (
          <>
            {/* bold take title */}
            {deck.takeTitle ? (
              <p className="text-[15px] font-semibold text-foreground">
                {deck.takeTitle}
              </p>
            ) : null}

            {/* small inline playback, right under the picture, above the text */}
            {m.audioRef ? (
              <MediaPlayer
                src={m.audioRef}
                startOffsetMs={m.startOffsetMs}
                durationMs={m.durationMs}
              />
            ) : null}

            {/* your text — same font, not bold */}
            {m.transcript ? (
              <p className="text-[15px] leading-relaxed text-foreground">
                {m.transcript}
              </p>
            ) : null}

            {/* Advise ▾ — the coach's note */}
            {m.note ? (
              <Toggle title="Advise">
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                  {m.note}
                </p>
              </Toggle>
            ) : null}

            {/* Data ▾ — the acoustic numbers (shows once the BE adds features) */}
            {m.features ? (
              <Toggle title="Data">
                <FeaturesData features={m.features} />
              </Toggle>
            ) : null}
          </>
        ) : (
          <p className="text-[15px] text-muted-foreground">
            No standout moment on this slide yet.
          </p>
        )}
      </div>
    </div>
  );
}

function NavBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

/** Bold title + arrow, content toggles open. */
function Toggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5"
      >
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

/** The acoustic numbers — same font/size, no tiny labels. */
function FeaturesData({ features: f }: { features: ReadoutFeatures }) {
  const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : "—");
  const pct = (v: number | null) => (v != null ? `${Math.round(v * 100)}%` : "—");
  const wpm = (v: number | null) => (v != null ? `${Math.round(v)} wpm` : "—");
  const db = (v: number | null) => (v != null ? `${Math.round(v)} dB` : "—");
  return (
    <div className="flex flex-col gap-1 text-[15px] leading-relaxed text-foreground">
      <p>Pitch: F0 mean {hz(f.f0Mean)}, SD {hz(f.f0Sd)}</p>
      <p>Pace: {wpm(f.speechRate)}, pause {pct(f.pauseRatio)}</p>
      <p>Volume: range {db(f.loudnessRange)}, voiced {pct(f.voicedRatio)}</p>
    </div>
  );
}
