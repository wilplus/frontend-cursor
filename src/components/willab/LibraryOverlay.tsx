"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  fetchStrengths,
  strengthsHome,
  type BestLines,
  type StrengthMoment,
  type StrengthTraining,
  type StrengthsView,
  type TakeCard,
} from "@/services/api/strengths";
import { SlideRender } from "./pdfSlides";
import { SlidePlaceholder, SlideTake, type SlideTakeEntry } from "./SlideTake";
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

/** Map a Deck's slides to the generic SlideTakeEntry shape. */
function deckToEntries(deck: Deck): SlideTakeEntry[] {
  return deck.slides.map((s, i): SlideTakeEntry => {
    const m = s.moment;
    return {
      key: String(i),
      presentationRef: deck.presentationRef,
      slideIndex: s.index,
      // Only show the take title when there is actually a moment — otherwise
      // the empty-state message ("No standout moment…") should show instead.
      topBar:
        m && deck.takeTitle ? (
          <p className="text-[15px] font-semibold text-foreground">
            {deck.takeTitle}
          </p>
        ) : undefined,
      audioRef: m?.audioRef ?? null,
      startOffsetMs: m?.startOffsetMs,
      durationMs: m?.durationMs,
      transcript: m?.transcript,
      advise: m?.note ? (
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {m.note}
        </p>
      ) : null,
      features: m?.features ?? null,
    };
  });
}

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
            entries={deckToEntries(deck)}
            slideIdx={slideIdx}
            onSlideIdx={setSlideIdx}
          />
        ) : deck ? (
          <SlideList deck={deck} onOpenSlide={(i) => setSlideIdx(i)} />
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
